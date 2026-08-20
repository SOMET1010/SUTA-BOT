/**
 * Normalisation des événements du canal de données ("oai-events") d'une
 * session Realtime GA (Azure OpenAI / OpenAI), reçus en JSON sur le data
 * channel WebRTC. Fonction pure et testable, séparée de l'orchestration
 * WebRTC elle-même (`RealtimeClient.ts`, qui n'est pas testable en dehors
 * d'un navigateur réel).
 *
 * Contrat vérifié par recherche documentaire (voir docs/architecture.md —
 * `learn.microsoft.com` et `platform.openai.com` sont bloqués par la
 * politique réseau de l'environnement de développement, donc non testé
 * contre une session live). Les événements non reconnus ou sans intérêt
 * pour l'interface (ex. `session.created`, `rate_limits.updated`) sont
 * ignorés (`null`) plutôt que de faire échouer le traitement.
 */

export type NormalizedRealtimeEvent =
  | { type: "speech_started" }
  | { type: "speech_stopped" }
  | { type: "user_transcript_delta"; delta: string }
  | { type: "user_transcript_done"; transcript: string }
  | { type: "assistant_transcript_delta"; delta: string }
  | { type: "assistant_transcript_done"; transcript: string }
  | { type: "response_created" }
  | { type: "response_done" }
  | { type: "function_call_done"; callId: string; name: string; argumentsJson: string }
  | { type: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function normalizeServerEvent(raw: unknown): NormalizedRealtimeEvent | null {
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return null;
  }

  switch (raw.type) {
    case "input_audio_buffer.speech_started":
      return { type: "speech_started" };

    case "input_audio_buffer.speech_stopped":
      return { type: "speech_stopped" };

    case "conversation.item.input_audio_transcription.delta": {
      const delta = asString(raw.delta);
      return delta !== undefined ? { type: "user_transcript_delta", delta } : null;
    }

    case "conversation.item.input_audio_transcription.completed": {
      const transcript = asString(raw.transcript);
      return transcript !== undefined ? { type: "user_transcript_done", transcript } : null;
    }

    case "response.output_audio_transcript.delta": {
      const delta = asString(raw.delta);
      return delta !== undefined ? { type: "assistant_transcript_delta", delta } : null;
    }

    case "response.output_audio_transcript.done": {
      const transcript = asString(raw.transcript);
      return transcript !== undefined
        ? { type: "assistant_transcript_done", transcript }
        : null;
    }

    case "response.created":
      return { type: "response_created" };

    case "response.done":
      return { type: "response_done" };

    case "response.function_call_arguments.done": {
      const callId = asString(raw.call_id);
      const name = asString(raw.name);
      const argumentsJson = asString(raw.arguments);
      return callId !== undefined && name !== undefined && argumentsJson !== undefined
        ? { type: "function_call_done", callId, name, argumentsJson }
        : null;
    }

    case "error": {
      const errorDetail = isRecord(raw.error) ? raw.error : undefined;
      const message =
        (errorDetail && asString(errorDetail.message)) ||
        "Le moteur Realtime a signalé une erreur.";
      return { type: "error", message };
    }

    default:
      return null;
  }
}
