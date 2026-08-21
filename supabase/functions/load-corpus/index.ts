/**
 * Edge Function `load-corpus` — chargement du corpus RAG pré-découpé.
 *
 * Lit `ansut_rag_corpus.jsonl` déposé dans le bucket privé `corpus` et
 * l'insère dans `documents` / `document_chunks` via `upsert_corpus_entries`.
 * Le calcul des vecteurs est fait ensuite, séparément, par `embed-chunks`.
 *
 * Le corpus fait ~10 Mo : il transite par Supabase Storage plutôt que par des
 * requêtes SQL ligne à ligne. Idempotente (identifiants stables du corpus) :
 * relancer la fonction réingère en upsert, sans doublon.
 *
 * Reprise possible via `offset` si le budget de temps est atteint.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "corpus";
const DEFAULT_FILE = "ansut_rag_corpus.jsonl";
const DEFAULT_BATCH = 500;
const DEFAULT_MAX_SECONDS = 120;

interface CorpusEntry {
  id: string;
  source: string;
  type: string;
  title: string;
  region: string | null;
  departement: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

interface ParseFailure {
  line: number;
  error: string;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variable manquante : ${name}.`);
  return value;
}

/**
 * Une ligne invalide n'interrompt pas les suivantes — elle est collectée et
 * rapportée, comme le fait le pipeline Node (`parseCorpusFile`).
 */
function parseCorpus(text: string): { entries: CorpusEntry[]; failures: ParseFailure[] } {
  const entries: CorpusEntry[] = [];
  const failures: ParseFailure[] = [];

  text.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    try {
      const parsed = JSON.parse(line);
      for (const field of ["id", "title", "content", "source", "type"]) {
        if (typeof parsed[field] !== "string" || parsed[field].length === 0) {
          throw new Error(`champ "${field}" manquant ou invalide`);
        }
      }
      entries.push({
        id: parsed.id,
        source: parsed.source,
        type: parsed.type,
        title: parsed.title,
        region: typeof parsed.region === "string" ? parsed.region : null,
        departement: typeof parsed.departement === "string" ? parsed.departement : null,
        content: parsed.content,
        metadata:
          typeof parsed.metadata === "object" && parsed.metadata !== null ? parsed.metadata : {},
      });
    } catch (error) {
      failures.push({
        line: index + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { entries, failures };
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

  try {
    const options = await req.json().catch(() => ({}));
    const file: string = options.file ?? DEFAULT_FILE;
    const batchSize: number = options.batch ?? DEFAULT_BATCH;
    const maxSeconds: number = options.maxSeconds ?? DEFAULT_MAX_SECONDS;
    const startOffset: number = options.offset ?? 0;
    const limit: number | undefined = options.limit;

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(file);

    if (downloadError || !blob) {
      throw new Error(
        `Fichier "${file}" introuvable dans le bucket "${BUCKET}" : ` +
          `${downloadError?.message ?? "réponse vide"}. ` +
          `Déposez-le via Dashboard → Storage → ${BUCKET}.`,
      );
    }

    const { entries: all, failures } = parseCorpus(await blob.text());
    const entries = limit === undefined ? all : all.slice(0, limit);

    let offset = startOffset;
    let upserted = 0;

    while (offset < entries.length && (Date.now() - startedAt) / 1000 < maxSeconds) {
      const batch = entries.slice(offset, offset + batchSize);
      const { error } = await supabase.rpc("upsert_corpus_entries", { payload: batch });
      if (error) throw new Error(`Upsert (offset ${offset}) : ${error.message}`);
      upserted += batch.length;
      offset += batch.length;
    }

    return Response.json({
      ok: true,
      totalInFile: all.length,
      upserted,
      nextOffset: offset < entries.length ? offset : null,
      parseFailures: failures.slice(0, 20),
      parseFailureCount: failures.length,
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
      },
      { status: 500 },
    );
  }
});
