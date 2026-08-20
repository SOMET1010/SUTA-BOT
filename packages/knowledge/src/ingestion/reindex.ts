import { prisma, setDocumentChunkEmbedding } from "@suta/database";
import { createEmbeddingsProvider } from "../embeddings/factory";

const BATCH_SIZE = 50;

export interface ReindexResult {
  chunkCount: number;
}

/**
 * Recalcule les embeddings de tous les fragments existants avec le
 * fournisseur actuellement configuré (`EMBEDDINGS_PROVIDER`). Utile après un
 * changement de modèle d'embedding (`npm run knowledge:reindex`).
 */
export async function reindexAllChunks(): Promise<ReindexResult> {
  const provider = createEmbeddingsProvider();
  const chunks = await prisma.documentChunk.findMany({
    select: { id: true, content: true },
  });

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await provider.embed(batch.map((chunk) => chunk.content));
    for (let j = 0; j < batch.length; j += 1) {
      await setDocumentChunkEmbedding(batch[j].id, embeddings[j]);
    }
  }

  return { chunkCount: chunks.length };
}
