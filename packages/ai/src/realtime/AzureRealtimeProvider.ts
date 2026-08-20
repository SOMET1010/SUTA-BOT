import type {
  CreateRealtimeSessionOptions,
  RealtimeProvider,
  RealtimeSession,
} from "./types";

export interface AzureRealtimeProviderConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  region?: string;
  /** Nom du modèle Realtime, tel que confirmé par l'équipe IT/PIE. */
  model?: string;
}

/**
 * Squelette du RealtimeProvider Azure OpenAI / Azure AI Foundry.
 *
 * Non implémenté tant que les informations de la section 67 du cahier des
 * charges (nom exact du modèle Realtime, deployment, quota, mode
 * d'authentification) n'ont pas été communiquées par l'équipe IT/PIE. Ne
 * suppose aucune valeur par défaut pour le modèle ou le deployment.
 */
export class AzureRealtimeProvider implements RealtimeProvider {
  readonly name = "azure";

  constructor(private readonly config: AzureRealtimeProviderConfig) {
    if (!config.endpoint || !config.apiKey || !config.deployment) {
      throw new Error(
        "AzureRealtimeProvider: endpoint, apiKey et deployment sont requis " +
          "(AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, REALTIME_DEPLOYMENT).",
      );
    }
  }

  async createSession(
    _options?: CreateRealtimeSessionOptions,
  ): Promise<RealtimeSession> {
    throw new Error(
      "AzureRealtimeProvider.createSession n'est pas encore implémenté : " +
        "en attente de la confirmation du modèle Realtime Azure par l'équipe " +
        "IT/PIE (cahier des charges, section 67). Utiliser AI_PROVIDER=mock " +
        "en attendant.",
    );
  }

  async disconnect(_sessionId: string): Promise<void> {
    throw new Error("AzureRealtimeProvider.disconnect n'est pas encore implémenté.");
  }
}
