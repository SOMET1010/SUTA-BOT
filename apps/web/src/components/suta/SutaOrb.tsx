import type { ConversationState } from "@suta/shared";

const WAVE_RING_COUNT = 3;

/**
 * Avatar SUTA — thème clair ANSUT (halo, anneaux, ondes). Remplace
 * l'ancien `components/SutaOrb.tsx` (thème sombre, supprimé — /admin
 * n'utilise pas cet avatar). Purement CSS/SVG : aucune image ni vidéo
 * (consigne UI explicite).
 */
export function SutaOrb({ state }: { state: ConversationState }) {
  const isError = state === "ERROR" || state === "OFFLINE";
  const isListening = state === "LISTENING" || state === "INTERRUPTED";
  const isSpeaking = state === "SPEAKING";
  const isSearching = state === "SEARCHING" || state === "THINKING";

  return (
    <div
      role="img"
      aria-label={`Avatar SUTA, état : ${state.toLowerCase()}`}
      className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56"
    >
      {/* Halo diffus */}
      <div
        className={`absolute inset-0 rounded-full blur-2xl animate-suta-halo-breathe ${
          isError
            ? "bg-status-error/25"
            : "bg-gradient-to-br from-ansut-blue/30 to-ansut-orange/30"
        }`}
      />

      {/* Ondes sonores (parole en cours) */}
      {isSpeaking &&
        Array.from({ length: WAVE_RING_COUNT }).map((_, index) => (
          <div
            key={index}
            className="absolute h-32 w-32 rounded-full border border-ansut-orange/50 animate-suta-wave sm:h-36 sm:w-36"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}

      {/* Anneau extérieur, rotation lente et continue */}
      <div
        className="absolute h-40 w-40 rounded-full border border-dashed border-ansut-blue/25 animate-suta-ring-slow sm:h-44 sm:w-44"
        aria-hidden="true"
      />

      {/* Anneau intérieur, rotation rapide pendant l'écoute */}
      <div
        className={`absolute h-32 w-32 rounded-full border-2 border-transparent sm:h-36 sm:w-36 ${
          isListening ? "border-t-ansut-orange animate-suta-ring-fast" : "border-t-ansut-blue/20"
        }`}
        aria-hidden="true"
      />

      {/* Cœur */}
      <div
        className={`relative flex h-24 w-24 items-center justify-center rounded-full shadow-lg sm:h-28 sm:w-28 ${
          isError
            ? "bg-status-error/90"
            : "bg-gradient-to-br from-ansut-blue to-ansut-orange animate-suta-core-pulse"
        }`}
      >
        {isSearching && (
          <span className="h-3 w-3 rounded-full bg-white animate-suta-search-pulse" />
        )}
      </div>
    </div>
  );
}
