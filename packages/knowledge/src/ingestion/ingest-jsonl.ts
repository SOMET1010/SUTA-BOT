import { readFile } from "node:fs/promises";
import { Prisma, prisma, setDocumentChunkEmbedding } from "@suta/database";
import type { Visibility } from "@suta/database";
import { createEmbeddingsProvider } from "../embeddings/factory";
import type { EmbeddingsProvider } from "../embeddings/types";
import { parseCorpusFile, toChunkMetadata, type CorpusEntry } from "./jsonl-corpus";

export interface IngestJsonlOptions {
  filePath: string;
  /** KnowledgeSource créée/réutilisée pour rattacher tous les documents. */
  sourceId: string;
  sourceName?: string;
  sourceDescription?: string;
  visibility?: Visibility;
  /** Nombre de textes envoyés par appel à l'EmbeddingsProvider. */
  batchSize?: number;
  /** N'ingère que les N premières entrées valides — pour valider le pipeline avant un run complet. */
  limit?: number;
  embeddingsProvider?: EmbeddingsProvider;
  onProgress?: (done: number, total: number) => void;
}

export interface IngestJsonlFailure {
  id: string;
  error: string;
}

export interface IngestJsonlResult {
  total: number;
  succeeded: number;
  parseFailed: { line: number; error: string }[];
  storeFailed: IngestJsonlFailure[];
}

const DEFAULT_BATCH_SIZE = 64;

/**
 * Ingère un corpus RAG déjà découpé (format JSONL, un chunk autonome par
 * ligne avec identifiant stable — voir `jsonl-corpus.ts`) : chaque entrée
 * devient un `Document` à un seul `DocumentChunk`, plutôt que de repasser
 * par le découpeur du pipeline `ingest.ts` (qui casserait le découpage
 * déjà optimal et les métadonnées riches par entrée).
 *
 * Idempotent par construction (`upsert` sur l'id stable de chaque entrée) :
 * une réingestion après régénération du corpus met à jour sans dupliquer,
 * conformément à la garantie du README fourni avec le corpus.
 */
export async function ingestJsonlCorpus(
  options: IngestJsonlOptions,
): Promise<IngestJsonlResult> {
  const provider = options.embeddingsProvider ?? createEmbeddingsProvider();
  const visibility = options.visibility ?? "PUBLIC";
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;

  await prisma.knowledgeSource.upsert({
    where: { id: options.sourceId },
    update: {},
    create: {
      id: options.sourceId,
      name: options.sourceName ?? options.sourceId,
      type: "generated",
      description: options.sourceDescription,
    },
  });

  const raw = await readFile(options.filePath, "utf-8");
  const { entries: allEntries, errors: parseFailed } = parseCorpusFile(raw);
  const entries =
    options.limit !== undefined ? allEntries.slice(0, options.limit) : allEntries;

  const storeFailed: IngestJsonlFailure[] = [];
  let succeeded = 0;

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);

    let embeddings: number[][];
    try {
      embeddings = await provider.embed(batch.map((entry) => entry.content));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      batch.forEach((entry) =>
        storeFailed.push({ id: entry.id, error: `Échec du calcul d'embeddings : ${message}` }),
      );
      options.onProgress?.(Math.min(i + batchSize, entries.length), entries.length);
      continue;
    }

    for (let j = 0; j < batch.length; j += 1) {
      const entry = batch[j];
      try {
        await storeEntry(entry, embeddings[j], options.sourceId, visibility);
        succeeded += 1;
      } catch (error) {
        storeFailed.push({
          id: entry.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    options.onProgress?.(Math.min(i + batchSize, entries.length), entries.length);
  }

  return { total: entries.length, succeeded, parseFailed, storeFailed };
}

async function storeEntry(
  entry: CorpusEntry,
  embedding: number[],
  sourceId: string,
  visibility: Visibility,
): Promise<void> {
  await prisma.document.upsert({
    where: { id: entry.id },
    update: { title: entry.title, status: "PENDING" },
    create: {
      id: entry.id,
      title: entry.title,
      filename: `${entry.id}.json`,
      mimeType: "application/json",
      sourceType: "MANUAL",
      visibility,
      sourceId,
      status: "PENDING",
    },
  });

  const chunkId = `${entry.id}-chunk`;
  const metadata = toChunkMetadata(entry) as Prisma.InputJsonValue;

  await prisma.documentChunk.upsert({
    where: { id: chunkId },
    update: { content: entry.content, section: entry.region, metadata },
    create: {
      id: chunkId,
      documentId: entry.id,
      content: entry.content,
      section: entry.region,
      metadata,
    },
  });

  await setDocumentChunkEmbedding(chunkId, embedding);

  await prisma.document.update({
    where: { id: entry.id },
    data: { status: "INDEXED", indexedAt: new Date() },
  });
}
