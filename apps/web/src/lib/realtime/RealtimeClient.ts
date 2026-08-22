import { normalizeServerEvent } from "./events";

/**
 * Connexion WebRTC réelle à une session Realtime (Azure OpenAI, GA —
 * cahier des charges, section 11 et 13). Établit la connexion directement
 * depuis le navigateur avec le `clientSecret` éphémère fourni par
 * `POST /api/realtime/session` — jamais avec une clé permanente.
 *
 * ⚠️ Contrat vérifié par recherche documentaire uniquement : cet
 * environnement de développement n'a pas d'accès réseau sortant vers
 * `*.openai.azure.com` (politique réseau du sandbox), donc cette classe
 * n'a **pas** pu être testée contre une session Realtime live. À valider
 * dans un environnement disposant d'un accès réseau réel et d'une clé API
 * Azure valide. Voir docs/architecture.md.
 */

export type RealtimeConnectionState = "connecting" | "connected" | "disconnected";

/** Au-delà, mieux vaut une erreur claire qu'un micro qui n'écoute personne. */
const DATA_CHANNEL_OPEN_TIMEOUT_MS = 15_000;

export interface RealtimeClientCallbacks {
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onUserTranscriptDelta?: (delta: string) => void;
  onUserTranscriptDone?: (transcript: string) => void;
  onAssistantTranscriptDelta?: (delta: string) => void;
  onAssistantTranscriptDone?: (transcript: string) => void;
  onResponseCreated?: () => void;
  onResponseDone?: () => void;
  onConnectionStateChange?: (state: RealtimeConnectionState) => void;
  onError?: (message: string) => void;
}

export interface RealtimeClientOptions {
  clientSecret: string;
  webrtcUrl: string;
  /** Exécute un appel d'outil (function calling) et retourne son résultat. */
  executeTool: (name: string, argumentsJson: string) => Promise<unknown>;
  callbacks?: RealtimeClientCallbacks;
}

export class RealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private hasActiveResponse = false;
  private connectionState: RealtimeConnectionState = "disconnected";

  constructor(private readonly options: RealtimeClientOptions) {}

  async connect(): Promise<void> {
    this.setConnectionState("connecting");

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.setConnectionState("disconnected");
      throw new Error(
        "Accès au microphone refusé ou indisponible. Autorisez l'accès au microphone puis réessayez.",
      );
    }

    const pc = new RTCPeerConnection();
    this.peerConnection = pc;

    for (const track of this.micStream.getAudioTracks()) {
      pc.addTrack(track, this.micStream);
    }

    this.audioEl = new Audio();
    this.audioEl.autoplay = true;
    pc.ontrack = (event) => {
      if (this.audioEl) {
        // La piste distante arrive souvent sans stream associé (pas de msid
        // dans le SDP du service Realtime) : `event.streams[0]` est alors
        // undefined et aucun son ne sort, jamais. On reconstruit un stream
        // depuis la piste elle-même dans ce cas.
        this.audioEl.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        this.audioEl.play().catch(() => {
          this.options.callbacks?.onError?.(
            "La lecture audio n'a pas pu démarrer automatiquement.",
          );
        });
      }
    };

    const dc = pc.createDataChannel("oai-events");
    this.dataChannel = dc;
    dc.onmessage = (event) => this.handleServerEvent(event.data);
    dc.onerror = () => {
      this.options.callbacks?.onError?.("Erreur sur le canal de données Realtime.");
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        this.setConnectionState("connected");
      } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        this.setConnectionState("disconnected");
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    let response: Response;
    try {
      response = await fetch(this.options.webrtcUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.options.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
    } catch {
      this.setConnectionState("disconnected");
      throw new Error("Connexion au service Realtime impossible (réseau).");
    }

    if (!response.ok) {
      this.setConnectionState("disconnected");
      throw new Error(`Échec de l'établissement de la session Realtime (HTTP ${response.status}).`);
    }

    const answerSdp = await response.text();
    await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    // La négociation SDP acceptée ne signifie pas que la session est
    // utilisable : le canal d'événements s'ouvre un instant plus tard. Rendre
    // la main avant son ouverture faisait annoncer « Je vous écoute » alors
    // que rien ne pouvait encore être reçu — la première question était
    // perdue et l'utilisateur devait la répéter.
    try {
      await this.waitForDataChannelOpen(dc);
    } catch (error) {
      this.setConnectionState("disconnected");
      throw error;
    }
  }

  private waitForDataChannelOpen(channel: RTCDataChannel): Promise<void> {
    if (channel.readyState === "open") return Promise.resolve();

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("La session vocale n'a pas fini de s'ouvrir. Réessayez."));
      }, DATA_CHANNEL_OPEN_TIMEOUT_MS);

      channel.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      channel.addEventListener(
        "close",
        () => {
          clearTimeout(timer);
          reject(new Error("La session vocale s'est fermée avant d'être prête."));
        },
        { once: true },
      );
    });
  }

  disconnect(): void {
    this.dataChannel?.close();
    this.dataChannel = null;

    this.peerConnection?.close();
    this.peerConnection = null;

    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;

    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl = null;
    }

    this.hasActiveResponse = false;
    this.setConnectionState("disconnected");
  }

  /**
   * Envoie un message texte de l'utilisateur pendant une session live
   * (repli clavier, cahier des charges section 54 : la voix ne doit pas
   * être le seul moyen d'utiliser SUTA) et demande une réponse.
   */
  sendUserText(text: string): void {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    this.send({ type: "response.create" });
  }

  /** Interrompt la réponse en cours (cahier des charges, section 13). */
  interrupt(): void {
    if (this.hasActiveResponse) {
      this.send({ type: "response.cancel" });
    }
  }

  private setConnectionState(state: RealtimeConnectionState) {
    this.connectionState = state;
    this.options.callbacks?.onConnectionStateChange?.(state);
  }

  private send(event: Record<string, unknown>): void {
    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(JSON.stringify(event));
    }
  }

  private handleServerEvent(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const event = normalizeServerEvent(parsed);
    if (!event) return;

    const callbacks = this.options.callbacks;
    switch (event.type) {
      case "speech_started":
        callbacks?.onSpeechStarted?.();
        // Interruption naturelle : si SUTA parle déjà, on arrête sa réponse.
        this.interrupt();
        break;
      case "speech_stopped":
        callbacks?.onSpeechStopped?.();
        break;
      case "user_transcript_delta":
        callbacks?.onUserTranscriptDelta?.(event.delta);
        break;
      case "user_transcript_done":
        callbacks?.onUserTranscriptDone?.(event.transcript);
        break;
      case "assistant_transcript_delta":
        callbacks?.onAssistantTranscriptDelta?.(event.delta);
        break;
      case "assistant_transcript_done":
        callbacks?.onAssistantTranscriptDone?.(event.transcript);
        break;
      case "response_created":
        this.hasActiveResponse = true;
        callbacks?.onResponseCreated?.();
        break;
      case "response_done":
        this.hasActiveResponse = false;
        callbacks?.onResponseDone?.();
        break;
      case "function_call_done":
        void this.runToolCall(event.callId, event.name, event.argumentsJson);
        break;
      case "error":
        callbacks?.onError?.(event.message);
        break;
    }
  }

  private async runToolCall(callId: string, name: string, argumentsJson: string): Promise<void> {
    let output: unknown;
    try {
      output = await this.options.executeTool(name, argumentsJson);
    } catch (error) {
      output = { error: error instanceof Error ? error.message : "Échec de l'outil." };
    }

    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    });
    this.send({ type: "response.create" });
  }
}
