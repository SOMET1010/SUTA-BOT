/**
 * Edge Function `embed-chunks` — calcul des embeddings du corpus.
 *
 * Pourquoi une Edge Function plutôt que le script Node `knowledge:ingest-jsonl` :
 * l'environnement d'assistance n'a pas d'accès réseau sortant (ni Azure, ni
 * Supabase), le script local ne peut donc pas être lancé à distance. Cette
 * fonction tourne chez Supabase, qui a l'accès réseau, et est pilotée depuis
 * SQL via `pg_net`. Le script Node reste la voie normale pour une machine de
 * développement.
 *
 * Traite les fragments dont `embedding IS NULL` par lots, dans la limite d'un
 * budget de temps, puis rend la main en indiquant ce qu'il reste à faire.
 * Idempotente : relancer la fonction reprend simplement là où elle s'est
 * arrêtée.
 *
 * Secrets attendus (Dashboard → Edge Functions → Secrets) :
 *   AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, EMBEDDINGS_DEPLOYMENT
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

/** Azure limite la taille d'une entrée ; les fragments du corpus sont bien en deçà. */
const MAX_CHARS_PER_INPUT = 6000;
const DEFAULT_BATCH = 64;
const DEFAULT_MAX_SECONDS = 60;

interface AzureEmbeddingsResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `Secret manquant : ${name}. À renseigner dans Dashboard → Edge Functions → Secrets.`,
    );
  }
  return value;
}

async function embedBatch(
  texts: string[],
  endpoint: string,
  apiKey: string,
  deployment: string,
): Promise<number[][]> {
  const url = new URL("/openai/v1/embeddings", endpoint);
  const response = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: deployment,
      input: texts.map((text) => text.slice(0, MAX_CHARS_PER_INPUT)),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Azure embeddings HTTP ${response.status} : ${detail.slice(0, 500)}`);
  }

  const payload = (await response.json()) as AzureEmbeddingsResponse;
  return [...payload.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

  try {
    const options = await req.json().catch(() => ({}));
    const batchSize: number = options.batch ?? DEFAULT_BATCH;
    const maxSeconds: number = options.maxSeconds ?? DEFAULT_MAX_SECONDS;

    const endpoint = requireEnv("AZURE_OPENAI_ENDPOINT");
    const apiKey = requireEnv("AZURE_OPENAI_API_KEY");
    const deployment = requireEnv("EMBEDDINGS_DEPLOYMENT");

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    let processed = 0;
    let dimensions: number | null = null;

    while ((Date.now() - startedAt) / 1000 < maxSeconds) {
      const { data: pending, error } = await supabase
        .from("document_chunks")
        .select("id, content")
        .is("embedding", null)
        .limit(batchSize);

      if (error) throw new Error(`Lecture des fragments : ${error.message}`);
      if (!pending || pending.length === 0) break;

      const vectors = await embedBatch(
        pending.map((chunk) => chunk.content as string),
        endpoint,
        apiKey,
        deployment,
      );
      dimensions = vectors[0]?.length ?? dimensions;

      const payload = pending.map((chunk, index) => ({
        id: chunk.id,
        embedding: `[${vectors[index].join(",")}]`,
      }));

      const { error: writeError } = await supabase.rpc("set_chunk_embeddings", { payload });
      if (writeError) throw new Error(`Écriture des vecteurs : ${writeError.message}`);

      processed += pending.length;
    }

    const { count: remaining } = await supabase
      .from("document_chunks")
      .select("id", { count: "exact", head: true })
      .is("embedding", null);

    return Response.json({
      ok: true,
      processed,
      remaining: remaining ?? 0,
      dimensions,
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
