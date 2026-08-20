import type { EmbeddingsProvider } from "./types";

export interface AzureEmbeddingsProviderConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  dimensions?: number;
}

/**
 * Squelette du fournisseur d'embeddings Azure OpenAI / Azure AI Foundry.
 * Non implémenté tant que le déploiement d'embeddings n'a pas été confirmé
 * par l'équipe IT/PIE (cahier des charges, section 67). Utiliser
 * EMBEDDINGS_PROVIDER=mock en attendant.
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

  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error(
      "AzureEmbeddingsProvider.embed n'est pas encore implémenté : en attente " +
        "de la confirmation du déploiement d'embeddings Azure par l'équipe IT/PIE.",
    );
  }
}
