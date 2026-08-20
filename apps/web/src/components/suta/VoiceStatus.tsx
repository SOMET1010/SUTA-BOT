import { CONVERSATION_STATE_LABELS, type ConversationState } from "@suta/shared";

const STATE_DOT_CLASS: Record<ConversationState, string> = {
  IDLE: "bg-ansut-orange",
  LISTENING: "bg-status-success",
  THINKING: "bg-status-warning",
  SEARCHING: "bg-status-warning",
  SPEAKING: "bg-ansut-orange",
  INTERRUPTED: "bg-status-warning",
  ERROR: "bg-status-error",
  OFFLINE: "bg-ansut-text-muted",
};

/** Pastille de statut — thème clair ANSUT. Remplace `components/StateIndicator.tsx`. */
export function VoiceStatus({ state }: { state: ConversationState }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-ansut-border bg-ansut-surface px-4 py-1.5 text-sm text-ansut-blue"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 rounded-full ${STATE_DOT_CLASS[state]} ${
          state === "LISTENING" || state === "SPEAKING" ? "animate-pulse" : ""
        }`}
      />
      {CONVERSATION_STATE_LABELS[state]}
    </div>
  );
}
