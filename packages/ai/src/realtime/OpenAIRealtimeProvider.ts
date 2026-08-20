import type {
  CreateRealtimeSessionOptions,
  RealtimeProvider,
  RealtimeSession,
} from "./types";

export interface OpenAIRealtimeProviderConfig {
  apiKey: string;
  /** Nom du modèle Realtime OpenAI. */
  model?: string;
}

/**
 * Squelette du RealtimeProvider OpenAI, utilisable en environnement de
 * développement autorisé en attendant la disponibilité du service Azure
 * (cahier des charges, section 68). Non implémenté dans ce commit.
 */
export class OpenAIRealtimeProvider implements RealtimeProvider {
  readonly name = "openai";

  constructor(private readonly config: OpenAIRealtimeProviderConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAIRealtimeProvider: apiKey est requis (OPENAI_API_KEY).");
    }
  }

  async createSession(
    _options?: CreateRealtimeSessionOptions,
  ): Promise<RealtimeSession> {
    throw new Error(
      "OpenAIRealtimeProvider.createSession n'est pas encore implémenté. " +
        "Utiliser AI_PROVIDER=mock en attendant (Lot 3).",
    );
  }

  async disconnect(_sessionId: string): Promise<void> {
    throw new Error("OpenAIRealtimeProvider.disconnect n'est pas encore implémenté.");
  }
}
