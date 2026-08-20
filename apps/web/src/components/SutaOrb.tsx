import type { ConversationState } from "@suta/shared";

const STATE_ANIMATION_CLASS: Record<ConversationState, string> = {
  IDLE: "animate-suta-breathe",
  LISTENING: "animate-suta-listen",
  THINKING: "animate-suta-think",
  SEARCHING: "animate-suta-think",
  SPEAKING: "animate-suta-speak",
  INTERRUPTED: "animate-suta-listen",
  ERROR: "",
  OFFLINE: "",
};

export function SutaOrb({ state }: { state: ConversationState }) {
  const isError = state === "ERROR" || state === "OFFLINE";

  return (
    <div
      role="img"
      aria-label={`Avatar SUTA, état : ${state.toLowerCase()}`}
      className="relative flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48"
    >
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br from-brand-secondary to-brand-primary blur-2xl opacity-60 ${STATE_ANIMATION_CLASS[state]}`}
      />
      <div
        className={`relative h-28 w-28 rounded-full border-2 sm:h-32 sm:w-32 ${
          isError ? "border-red-400 bg-red-950/40" : "border-brand-secondary/70 bg-brand-primary/30"
        } backdrop-blur-sm ${STATE_ANIMATION_CLASS[state]}`}
      />
    </div>
  );
}
