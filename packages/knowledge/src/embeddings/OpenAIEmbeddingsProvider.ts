import type { EmbeddingsProvider } from "./types";

export interface OpenAIEmbeddingsProviderConfig {
  apiKey: string;
  model?: string;
  dimensions?: number;
}

/**
 * Squelette du fournisseur d'embeddings OpenAI, pour un environnement de
 * développement autorisé en attendant Azure (section 68). Non implémenté
 * dans ce commit.
 */
export class OpenAIEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = "openai";
  readonly dimensions: number;

  constructor(private readonly config: OpenAIEmbeddingsProviderConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAIEmbeddingsProvider: apiKey est requis (OPENAI_API_KEY).");
    }
    this.dimensions = config.dimensions ?? 1536;
  }

  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "OpenAIEmbeddingsProvider.embed n'est pas encore implémenté. Utiliser " +
        "EMBEDDINGS_PROVIDER=mock en attendant.",
    );
  }
}
