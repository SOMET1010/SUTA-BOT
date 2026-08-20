import { prisma } from "./client.ts";
import { Prisma } from "../generated/client/client.ts";

/**
 * La colonne `embedding` (pgvector) est déclarée `Unsupported` dans le
 * schéma Prisma : elle n'apparaît pas dans les opérations typées du client
 * (`create`, `update`, ...) et doit être lue/écrite via des requêtes SQL
 * paramétrées. Ce module est le seul point d'accès à cette colonne : les
 * autres packages (ex. `@suta/knowledge`) passent uniquement par ces
 * fonctions plutôt que d'écrire du SQL brut elles-mêmes.
 */

function toVectorLiteral(embedding: number[]): string {
  if (embedding.length === 0 || !embedding.every((value) => Number.isFinite(value))) {
    throw new Error(
      "Embedding invalide : un vecteur non vide de nombres finis est requis.",
    );
  }
  return `[${embedding.join(",")}]`;
}

export async function setDocumentChunkEmbedding(
  chunkId: string,
  embedding: number[],
): Promise<void> {
  const vectorLiteral = toVectorLiteral(embedding);
  await prisma.$executeRaw`
    UPDATE document_chunks
    SET embedding = ${vectorLiteral}::vector
    WHERE id = ${chunkId}
  `;
}

export interface SimilarChunkResult {
  chunkId: string;
  documentId: string;
  content: string;
  page: number | null;
  section: string | null;
  metadata: Prisma.JsonValue | null;
  documentTitle: string;
  documentSourceType: string;
  documentVisibility: string;
  /** Distance cosinus pgvector : 0 = identique, 2 = opposé. */
  distance: number;
}

export interface FindSimilarChunksOptions {
  limit?: number;
  /** Niveaux de visibilité autorisés (ex. ["PUBLIC", "DEMO"]). */
  visibility?: string[];
}

/**
 * Recherche par similarité cosinus (opérateur pgvector `<=>`) parmi les
 * fragments de documents indexés. Ne renvoie que les documents au statut
 * `INDEXED` (cahier des charges, section 16-17).
 */
export async function findSimilarChunks(
  queryEmbedding: number[],
  options: FindSimilarChunksOptions = {},
): Promise<SimilarChunkResult[]> {
  const vectorLiteral = toVectorLiteral(queryEmbedding);
  const limit = options.limit ?? 5;
  const visibilityFilter =
    options.visibility && options.visibility.length > 0
      ? Prisma.sql`AND d.visibility::text IN (${Prisma.join(options.visibility)})`
      : Prisma.empty;

  return prisma.$queryRaw<SimilarChunkResult[]>`
    SELECT
      c.id AS "chunkId",
      c."documentId" AS "documentId",
      c.content AS "content",
      c.page AS "page",
      c.section AS "section",
      c.metadata AS "metadata",
      d.title AS "documentTitle",
      d."sourceType"::text AS "documentSourceType",
      d.visibility::text AS "documentVisibility",
      c.embedding <=> ${vectorLiteral}::vector AS "distance"
    FROM document_chunks c
    JOIN documents d ON d.id = c."documentId"
    WHERE d.status = 'INDEXED'
      AND c.embedding IS NOT NULL
      ${visibilityFilter}
    ORDER BY distance ASC
    LIMIT ${limit}
  `;
}
