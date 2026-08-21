/**
 * Lecture d'un corpus RAG pré-découpé au format JSONL (un chunk autonome
 * par ligne, avec identifiant stable) — distinct du pipeline
 * extraction/nettoyage/découpage habituel (`ingest.ts`), destiné aux
 * fichiers bruts (PDF/DOCX/TXT/MD) qui doivent encore être découpés.
 * Voir docs/architecture.md pour le contexte (corpus observatoire ANSUT).
 */
export interface CorpusEntry {
  id: string;
  source: string;
  type: string;
  title: string;
  region: string | null;
  departement: string | null;
  content: string;
  metadata: Record<string, unknown>;
}

export interface CorpusParseError {
  line: number;
  error: string;
}

export interface CorpusParseResult {
  entries: CorpusEntry[];
  errors: CorpusParseError[];
}

function requireString(
  value: unknown,
  field: string,
  lineNumber: number,
  id?: string,
): string {
  if (typeof value !== "string" || value.length === 0) {
    const prefix = id ? `Ligne ${lineNumber} (${id})` : `Ligne ${lineNumber}`;
    throw new Error(`${prefix} : champ "${field}" manquant ou invalide.`);
  }
  return value;
}

/** Parse une ligne JSONL en `CorpusEntry`, ou lève une erreur explicite. */
export function parseCorpusLine(line: string, lineNumber: number): CorpusEntry {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(`Ligne ${lineNumber} : JSON invalide.`);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Ligne ${lineNumber} : un objet JSON est attendu.`);
  }

  const obj = parsed as Record<string, unknown>;
  const id = requireString(obj.id, "id", lineNumber);
  const title = requireString(obj.title, "title", lineNumber, id);
  const content = requireString(obj.content, "content", lineNumber, id);
  const source = requireString(obj.source, "source", lineNumber, id);
  const type = requireString(obj.type, "type", lineNumber, id);

  return {
    id,
    source,
    type,
    title,
    region: typeof obj.region === "string" ? obj.region : null,
    departement: typeof obj.departement === "string" ? obj.departement : null,
    content,
    metadata:
      typeof obj.metadata === "object" && obj.metadata !== null
        ? (obj.metadata as Record<string, unknown>)
        : {},
  };
}

/**
 * Parse un fichier JSONL entier. Une ligne invalide n'interrompt pas les
 * suivantes — elle est collectée dans `errors` (même principe que
 * `ingestDirectory` pour les fichiers).
 */
export function parseCorpusFile(text: string): CorpusParseResult {
  const lines = text.split("\n");
  const entries: CorpusEntry[] = [];
  const errors: CorpusParseError[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    try {
      entries.push(parseCorpusLine(line, index + 1));
    } catch (error) {
      errors.push({
        line: index + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { entries, errors };
}

/**
 * Métadonnées stockées sur le fragment (`DocumentChunk.metadata`) : les
 * champs structurels du corpus (type, source, région, département) sont
 * fusionnés avec les métadonnées propres à l'entrée (score, population,
 * coordonnées, ...), pour permettre un filtrage ultérieur.
 */
export function toChunkMetadata(entry: CorpusEntry): Record<string, unknown> {
  return {
    corpusType: entry.type,
    corpusSource: entry.source,
    region: entry.region,
    departement: entry.departement,
    ...entry.metadata,
  };
}
