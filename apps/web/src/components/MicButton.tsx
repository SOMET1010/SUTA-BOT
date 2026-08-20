import type { ConversationState } from "@suta/shared";

interface MicButtonProps {
  state: ConversationState;
  onPress: () => void;
  disabled?: boolean;
}

export function MicButton({ state, onPress, disabled }: MicButtonProps) {
  const isListening = state === "LISTENING";
  const isBusy = state === "THINKING" || state === "SEARCHING";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || isBusy}
      aria-pressed={isListening}
      aria-label={
        isListening ? "Arrêter l'écoute" : "Activer le microphone pour parler à SUTA"
      }
      className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-lg transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-secondary disabled:cursor-not-allowed disabled:opacity-40 ${
        isListening
          ? "bg-emerald-500 scale-110"
          : "bg-brand-secondary hover:scale-105"
      }`}
    >
      <MicIcon />
    </button>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-brand-background"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="23" />
      <line x1="8" x2="16" y1="23" y2="23" />
    </svg>
  );
}
