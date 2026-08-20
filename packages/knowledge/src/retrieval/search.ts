import { findSimilarChunks } from "@suta/database";
import { createEmbeddingsProvider } from "../embeddings/factory";
import type { EmbeddingsProvider } from "../embeddings/types";

/**
 * Recherche documentaire sémantique (cahier des charges, sections 16-17).
 * Forme de réponse alignée sur l'outil `searchKnowledge` qui sera exposé au
 * modèle au Lot 5 (packages/tools) — ce module en porte la logique réelle.
 */

export interface SearchDocumentsOptions {
  limit?: number;
  /** Niveaux de visibilité autorisés. Par défaut : PUBLIC et DEMO (section 19, MVP Salon). */
  visibility?: string[];
  embeddingsProvider?: EmbeddingsProvider;
}

export interface SearchResult {
  title: string;
  content: string;
  source: string;
  /** Score de pertinence dans [0, 1], 1 = correspondance la plus forte. */
  score: number;
}

export interface SearchDocumentsResponse {
  results: SearchResult[];
}

const DEFAULT_VISIBILITY = ["PUBLIC", "DEMO"];

function distanceToScore(distance: number): number {
  return Math.max(0, Math.min(1, 1 - distance));
}

/**
 * Ne retourne jamais d'information non sourcée : si aucun fragment indexé
 * n'est suffisamment pertinent, `results` est vide et l'appelant (prompt
 * SUTA) doit indiquer qu'il ne dispose pas de l'information (section 58).
 */
export async function searchDocuments(
  query: string,
  options: SearchDocumentsOptions = {},
): Promise<SearchDocumentsResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { results: [] };
  }

  const provider = options.embeddingsProvider ?? createEmbeddingsProvider();
  const [queryEmbedding] = await provider.embed([trimmed]);

  const chunks = await findSimilarChunks(queryEmbedding, {
    limit: options.limit ?? 5,
    visibility: options.visibility ?? DEFAULT_VISIBILITY,
  });

  return {
    results: chunks.map((chunk) => ({
      title: chunk.documentTitle,
      content: chunk.content,
      source: chunk.section ? `${chunk.documentTitle} — ${chunk.section}` : chunk.documentTitle,
      score: distanceToScore(chunk.distance),
    })),
  };
}
