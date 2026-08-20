import { basename } from "node:path";
import { prisma, setDocumentChunkEmbedding } from "@suta/database";
import type { Visibility } from "@suta/database";
import { createEmbeddingsProvider } from "../embeddings/factory";
import type { EmbeddingsProvider } from "../embeddings/types";
import { cleanText } from "./clean";
import { chunkText } from "./chunk";
import { detectSourceType, extractText, mimeTypeForSourceType } from "./extract-text";

export interface IngestDocumentInput {
  filePath: string;
  title?: string;
  visibility?: Visibility;
  sourceId?: string;
  embeddingsProvider?: EmbeddingsProvider;
}

export interface IngestDocumentResult {
  documentId: string;
  title: string;
  chunkCount: number;
}

/**
 * Pipeline d'ingestion d'un document (cahier des charges, section 15) :
 * extraction → nettoyage → découpage → embeddings → stockage. Le document
 * est marqué `FAILED` si une étape échoue après sa création, plutôt que de
 * rester silencieusement dans un état incohérent.
 */
export async function ingestDocument(
  input: IngestDocumentInput,
): Promise<IngestDocumentResult> {
  const sourceType = detectSourceType(input.filePath);
  const title = input.title ?? basename(input.filePath);
  const provider = input.embeddingsProvider ?? createEmbeddingsProvider();

  const rawText = await extractText(input.filePath, sourceType);
  const cleaned = cleanText(rawText);
  if (!cleaned) {
    throw new Error(`Aucun contenu extrait de "${input.filePath}".`);
  }

  const chunks = chunkText(cleaned);
  if (chunks.length === 0) {
    throw new Error(`Aucun fragment généré pour "${input.filePath}".`);
  }

  const document = await prisma.document.create({
    data: {
      title,
      filename: basename(input.filePath),
      mimeType: mimeTypeForSourceType(sourceType),
      sourceType,
      visibility: input.visibility ?? "DEMO",
      sourceId: input.sourceId,
      status: "PENDING",
    },
  });

  try {
    const embeddings = await provider.embed(chunks.map((chunk) => chunk.content));

    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const createdChunk = await prisma.documentChunk.create({
        data: {
          documentId: document.id,
          content: chunk.content,
          metadata: { chunkIndex: chunk.index },
        },
      });
      await setDocumentChunkEmbedding(createdChunk.id, embeddings[i]);
    }

    await prisma.document.update({
      where: { id: document.id },
      data: { status: "INDEXED", indexedAt: new Date() },
    });
  } catch (error) {
    await prisma.document.update({
      where: { id: document.id },
      data: { status: "FAILED" },
    });
    throw error;
  }

  return { documentId: document.id, title, chunkCount: chunks.length };
}
