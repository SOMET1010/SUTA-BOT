import { AzureEmbeddingsProvider } from "./AzureEmbeddingsProvider";
import { MockEmbeddingsProvider } from "./MockEmbeddingsProvider";
import { OpenAIEmbeddingsProvider } from "./OpenAIEmbeddingsProvider";
import type { EmbeddingsProvider } from "./types";

export type EmbeddingsProviderName = "azure" | "openai" | "mock";

export interface EmbeddingsProviderEnv {
  EMBEDDINGS_PROVIDER?: string;
  EMBEDDING_DIMENSIONS?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  EMBEDDINGS_DEPLOYMENT?: string;
  OPENAI_API_KEY?: string;
  EMBEDDINGS_MODEL?: string;
}

const DEFAULT_DIMENSIONS = 1536;

/**
 * Instancie l'EmbeddingsProvider configuré via `EMBEDDINGS_PROVIDER`, sur le
 * même principe que `createRealtimeProvider` (packages/ai). La dimension par
 * défaut (1536) doit correspondre à la colonne pgvector de
 * `document_chunks.embedding` (packages/database/prisma/schema.prisma).
 */
export function createEmbeddingsProvider(
  env: EmbeddingsProviderEnv = process.env as EmbeddingsProviderEnv,
): EmbeddingsProvider {
  const providerName = (env.EMBEDDINGS_PROVIDER || "mock").toLowerCase() as EmbeddingsProviderName;
  const dimensions = env.EMBEDDING_DIMENSIONS
    ? Number.parseInt(env.EMBEDDING_DIMENSIONS, 10)
    : DEFAULT_DIMENSIONS;

  switch (providerName) {
    case "azure":
      return new AzureEmbeddingsProvider({
        endpoint: env.AZURE_OPENAI_ENDPOINT ?? "",
        apiKey: env.AZURE_OPENAI_API_KEY ?? "",
        deployment: env.EMBEDDINGS_DEPLOYMENT ?? "",
        dimensions,
      });
    case "openai":
      return new OpenAIEmbeddingsProvider({
        apiKey: env.OPENAI_API_KEY ?? "",
        model: env.EMBEDDINGS_MODEL,
        dimensions,
      });
    case "mock":
      return new MockEmbeddingsProvider(dimensions);
    default:
      throw new Error(
        `EMBEDDINGS_PROVIDER inconnu: "${providerName}". Valeurs attendues: azure | openai | mock.`,
      );
  }
}
