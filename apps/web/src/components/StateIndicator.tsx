import { CONVERSATION_STATE_LABELS, type ConversationState } from "@suta/shared";

const STATE_DOT_CLASS: Record<ConversationState, string> = {
  IDLE: "bg-brand-secondary",
  LISTENING: "bg-emerald-400",
  THINKING: "bg-amber-400",
  SEARCHING: "bg-amber-400",
  SPEAKING: "bg-brand-secondary",
  INTERRUPTED: "bg-amber-400",
  ERROR: "bg-red-400",
  OFFLINE: "bg-zinc-500",
};

export function StateIndicator({ state }: { state: ConversationState }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 text-sm text-brand-text/80"
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
