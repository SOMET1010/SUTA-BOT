import type { ConversationState } from "@suta/shared";
import type { SutaEmotion } from "@/lib/suta/scene";

const WAVE_RING_COUNT = 3;

/**
 * Avatar SUTA — présence lumineuse sur scène de nuit (halo, anneaux, ondes).
 * Purement CSS/SVG : aucune image, aucun visage dessiné (un personnage
 * cartoon a été essayé puis retiré : il faisait « mascotte de site web »).
 * L'émotion de la scène module la teinte du halo ; l'orbe est le bouton
 * vocal — la pastille sous elle porte l'invite.
 */
const EMOTION_HALO: Record<SutaEmotion, string> = {
  neutral: "from-ansut-blue-light/50 to-ansut-orange/30",
  warm: "from-ansut-blue-light/55 to-ansut-orange/45",
  curious: "from-ansut-blue-light/65 to-ansut-orange/35",
  thinking: "from-ansut-blue-light/65 to-ansut-blue-light/25",
  explaining: "from-ansut-blue-light/55 to-ansut-orange/45",
  reassuring: "from-ansut-blue-light/45 to-ansut-orange/40",
  celebrating: "from-ansut-orange/55 to-ansut-blue-light/40",
  alert: "from-status-error/50 to-status-error/20",
};

export function SutaOrb({ state, emotion = "warm" }: { state: ConversationState; emotion?: SutaEmotion }) {
  const isError = state === "ERROR" || state === "OFFLINE";
  const activeEmotion: SutaEmotion = isError ? "alert" : emotion;
  const isListening = state === "LISTENING" || state === "INTERRUPTED";
  const isSpeaking = state === "SPEAKING";
  const isSearching = state === "SEARCHING" || state === "THINKING";

  return (
    <div
      role="img"
      aria-label={`Avatar SUTA, état : ${state.toLowerCase()}`}
      data-emotion={activeEmotion}
      className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64"
    >
      {/* Halo diffus — la teinte suit l'émotion de la scène */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br blur-3xl animate-suta-halo-breathe ${EMOTION_HALO[activeEmotion]}`}
      />

      {/* Ondes sonores (parole en cours) */}
      {isSpeaking &&
        Array.from({ length: WAVE_RING_COUNT }).map((_, index) => (
          <div
            key={index}
            className="absolute h-40 w-40 rounded-full border border-ansut-orange/60 animate-suta-wave sm:h-44 sm:w-44"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}

      {/* Anneau extérieur, rotation lente et continue */}
      <div
        className="absolute h-48 w-48 rounded-full border border-dashed border-white/20 animate-suta-ring-slow sm:h-52 sm:w-52"
        aria-hidden="true"
      />

      {/* Anneau intérieur, rotation rapide pendant l'écoute */}
      <div
        className={`absolute h-40 w-40 rounded-full border-2 border-transparent sm:h-44 sm:w-44 ${
          isListening ? "border-t-ansut-orange animate-suta-ring-fast" : "border-t-white/15"
        }`}
        aria-hidden="true"
      />

      {/* Cœur lumineux */}
      <div
        className={`relative flex h-28 w-28 items-center justify-center rounded-full sm:h-32 sm:w-32 ${
          isError
            ? "bg-status-error/90 shadow-[0_0_60px_rgba(198,40,40,0.45)]"
            : "bg-gradient-to-br from-ansut-blue-light to-ansut-orange shadow-[0_0_80px_rgba(245,130,32,0.35)] animate-suta-core-pulse"
        }`}
      >
        {isSearching && (
          <span className="h-3 w-3 rounded-full bg-white animate-suta-search-pulse" />
        )}
      </div>

      {/* Invite / statut — l'orbe est le bouton, la pastille le dit. */}
      <div className="absolute -bottom-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">
        {isSpeaking ? "Je vous réponds" : isListening ? "Je vous écoute" : isSearching ? "Je cherche" : state === "CONNECTING" ? "Connexion…" : isError ? "Voix interrompue" : "Touchez-moi pour parler"}
      </div>
    </div>
  );
}
