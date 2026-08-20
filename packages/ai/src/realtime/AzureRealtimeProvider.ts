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

interface AzureClientSecretResponse {
  value: string;
  expires_at: number;
}

/**
 * RealtimeProvider Azure OpenAI (API GA `/openai/v1/realtime/client_secrets`,
 * confirmée par l'équipe IT/PIE — cahier des charges section 67 : ressource
 * `dtdi-openai-audio-01`, modèle/déploiement `gpt-realtime-2.1`,
 * authentification par clé API).
 *
 * Ne fait que créer une session éphémère côté serveur (clé temporaire
 * `client_secret`, valable une minute) : la connexion WebRTC réelle
 * (échange SDP, capture micro, lecture audio) est établie directement par
 * le navigateur avec le `clientSecret` retourné — jamais par ce backend
 * (cahier des charges, section 11). Cette connexion navigateur elle-même
 * (WebRTC, interruption, lecture des événements Realtime) reste à
 * implémenter côté `apps/web`.
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

  async createSession(options?: CreateRealtimeSessionOptions): Promise<RealtimeSession> {
    const url = new URL("/openai/v1/realtime/client_secrets", this.config.endpoint);

    const tools = options?.tools?.map((tool) => ({
      type: "function" as const,
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": this.config.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: this.config.deployment,
          instructions: options?.instructions,
          // Schéma GA : les réglages audio d'entrée (transcription, détection
          // de tour de parole) sont imbriqués sous `audio.input`, pas au
          // niveau racine de `session` (l'ancien schéma preview à plat —
          // `session.turn_detection` — est rejeté avec "unknown_parameter"
          // par le endpoint GA `/openai/v1/realtime/client_secrets`).
          audio: {
            input: {
              // Transcription de la voix de l'utilisateur, pour l'affichage
              // à l'écran (section 37) — sans cela, seule la réponse de
              // SUTA serait transcrite. `language: "fr"` fixe la langue
              // attendue (sinon le modèle peut dériver vers une autre
              // langue en cours de conversation si l'audio est ambigu).
              transcription: { model: "whisper-1", language: "fr" },
              // server_vad : détection automatique de la fin de prise de
              // parole et de l'interruption naturelle (section 13).
              turn_detection: { type: "server_vad" },
            },
          },
          ...(tools && tools.length > 0 ? { tools } : {}),
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `AzureRealtimeProvider: échec de création de session (HTTP ${response.status}). ${detail}`.trim(),
      );
    }

    const data = (await response.json()) as AzureClientSecretResponse;

    return {
      sessionId: `azure_${crypto.randomUUID()}`,
      provider: this.name,
      model: this.config.model || this.config.deployment,
      clientSecret: data.value,
      expiresAt: new Date(data.expires_at * 1000).toISOString(),
      webrtcUrl: new URL("/openai/v1/realtime/calls", this.config.endpoint).toString(),
    };
  }

  async disconnect(_sessionId: string): Promise<void> {
    // Le modèle de clé éphémère n'a pas de session à fermer côté serveur :
    // c'est le navigateur qui ferme la connexion WebRTC réelle. Rien à faire.
  }
}
