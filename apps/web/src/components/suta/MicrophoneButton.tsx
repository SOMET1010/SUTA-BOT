import type { ConversationState } from "@suta/shared";

interface MicrophoneButtonProps {
  state: ConversationState;
  onPress: () => void;
  disabled?: boolean;
  /**
   * Un appel Realtime réel est en cours : le bouton doit toujours permettre
   * de raccrocher, même pendant THINKING/SEARCHING (pas de blocage lié à
   * l'état de la conversation simulée).
   */
  liveCallActive?: boolean;
}

/** Bouton micro — thème clair ANSUT. Remplace `components/MicButton.tsx`. */
export function MicrophoneButton({ state, onPress, disabled, liveCallActive }: MicrophoneButtonProps) {
  const isListening = state === "LISTENING" || liveCallActive;
  const isBusy = !liveCallActive && (state === "THINKING" || state === "SEARCHING");

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || isBusy}
      aria-pressed={isListening}
      aria-label={
        liveCallActive
          ? "Raccrocher"
          : isListening
            ? "Arrêter l'écoute"
            : "Activer le microphone pour parler à SUTA"
      }
      className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-lg transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-ansut-orange focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
        isListening
          ? "scale-110 bg-status-error"
          : "bg-ansut-orange hover:scale-105"
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
      className="text-white"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="23" />
      <line x1="8" x2="16" y1="23" y2="23" />
    </svg>
  );
}
