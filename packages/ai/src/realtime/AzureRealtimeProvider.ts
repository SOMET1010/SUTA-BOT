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
  /** Voix de synthèse. Sans elle, la voix par défaut parle un français
   * mécanique — c'était l'un des trois reproches du premier test réel. */
  voice?: string;
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

    // Lot 3 (VOICE_ENGINE=azure-tts) : le modèle ne produit que du texte —
    // les oreilles (VAD, transcription) restent identiques, mais la voix est
    // synthétisée ailleurs (Azure Speech). Sans audio en sortie, le choix de
    // voix n'a plus de sens et n'est pas envoyé.
    const wantsAudioOut = !options?.outputModalities || options.outputModalities.includes("audio");

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
              // `prompt` amorce Whisper avec les toponymes ivoiriens que le
              // public prononcera : en test réel, « Korhogo » était transcrit
              // « Hugo » — et une localité mal entendue fausse tout le tour.
              transcription: {
                model: "whisper-1",
                language: "fr",
                prompt:
                  "Conversation sur les localités de Côte d'Ivoire : Abidjan, Korhogo, Bouaké, " +
                  "Yamoussoukro, Daloa, San-Pédro, Man, Odienné, Séguéla, Gagnoa, Divo, Abengourou, " +
                  "Bondoukou, Ferkessédougou, Boundiali, Katiola, Touba, Guiglo, Duékoué, Soubré, " +
                  "Agboville, Adzopé, Dabou, Grand-Bassam, Tiémé, Facobly, ANSUT, SUTA.",
              },
              // server_vad : détection de fin de prise de parole. Les seuils
              // par défaut (threshold 0.5) sont calibrés pour un casque au
              // calme : en conditions de salon, respirations et bruits brefs
              // déclenchaient des « prises de parole » fantômes qui coupaient
              // SUTA en pleine phrase. threshold relevé, silence allongé, et
              // surtout interrupt_response désactivé : le serveur ne coupe
              // plus tout seul — l'annulation est décidée côté client par la
              // garde de confirmation (BargeInGate, ~280 ms de parole
              // soutenue), qui distingue un bruit d'un vrai « attends ».
              turn_detection: {
                type: "server_vad",
                // Calibré sur 13 runs réels du banc vocal (23-24/08) : à 0,80
                // (relevé après une hallucination sur bruit TV), le VAD a raté
                // CINQ phrases entières — le citoyen parle et SUTA ne réagit
                // pas — contre UNE seule percée du bruit, contenue par le
                // garde du prompt (« bruit ambiant transcrit par erreur »).
                // Redescendu à 0,75 : l'anti-bruit a désormais deux couches
                // prouvées, l'écoute n'en a qu'une. REALTIME_VAD_THRESHOLD
                // permet d'ajuster au salon sans redéploiement (borné
                // 0,5-0,95).
                threshold: Math.min(0.95, Math.max(0.5, Number(process.env.REALTIME_VAD_THRESHOLD) || 0.75)),
                prefix_padding_ms: 300,
                silence_duration_ms: 600,
                interrupt_response: false,
              },
            },
            ...(wantsAudioOut
              ? {
                  output: {
                    // Casting du 24/08 (écoute de Patrick sur la campagne réelle) :
                    // « cedar », masculine, rend un français à l'accent
                    // nord-américain marqué — « la voix féminine était bien
                    // meilleure ». Retour à « marin ». REALTIME_VOICE permet
                    // toujours de changer sans toucher au code.
                    voice: this.config.voice || "marin",
                  },
                }
              : {}),
          },
          ...(options?.outputModalities ? { output_modalities: options.outputModalities } : {}),
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
