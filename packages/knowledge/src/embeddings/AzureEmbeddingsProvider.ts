import type { EmbeddingsProvider } from "./types";

export interface AzureEmbeddingsProviderConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  dimensions?: number;
}

interface AzureEmbeddingsResponse {
  data: { embedding: number[]; index: number }[];
}

/**
 * Fournisseur d'embeddings Azure OpenAI / Azure AI Foundry, endpoint GA
 * unifié `/openai/v1/embeddings` (même surface API que
 * `AzureRealtimeProvider` — voir docs/architecture.md, section
 * « Déploiement (Vercel) » pour le contexte de validation en conditions
 * réelles de ce schéma GA).
 */
export class AzureEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = "azure";
  readonly dimensions: number;

  constructor(private readonly config: AzureEmbeddingsProviderConfig) {
    if (!config.endpoint || !config.apiKey || !config.deployment) {
      throw new Error(
        "AzureEmbeddingsProvider: endpoint, apiKey et deployment sont requis " +
          "(AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, EMBEDDINGS_DEPLOYMENT).",
      );
    }
    this.dimensions = config.dimensions ?? 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const url = new URL("/openai/v1/embeddings", this.config.endpoint);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.deployment,
        input: texts,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `AzureEmbeddingsProvider: échec du calcul d'embeddings (HTTP ${response.status}). ${detail}`.trim(),
      );
    }

    const data = (await response.json()) as AzureEmbeddingsResponse;
    return [...data.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
