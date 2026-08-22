import type { ConversationState } from "@suta/shared";
import type { SutaEmotion } from "@/lib/suta/scene";

const WAVE_RING_COUNT = 3;

/**
 * Avatar SUTA — présence abstraite (halo, anneaux, ondes), thème clair ANSUT.
 * Purement CSS/SVG : aucune image, aucun visage dessiné. Un personnage
 * cartoon a été essayé puis retiré : il faisait « site web avec mascotte »,
 * pas « assistant IA premium ». L'émotion de la scène (`emotion`) module la
 * teinte du halo et le rythme du cœur, jamais une figure humaine.
 */
const EMOTION_HALO: Record<SutaEmotion, string> = {
  neutral: "from-ansut-blue/25 to-ansut-orange/20",
  warm: "from-ansut-blue/30 to-ansut-orange/30",
  curious: "from-ansut-blue/35 to-ansut-orange/25",
  thinking: "from-ansut-blue/35 to-ansut-blue/15",
  explaining: "from-ansut-blue/30 to-ansut-orange/30",
  reassuring: "from-ansut-blue/25 to-ansut-orange/25",
  celebrating: "from-ansut-orange/35 to-ansut-blue/25",
  alert: "from-status-error/30 to-status-error/15",
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
      className="relative flex h-52 w-52 items-center justify-center sm:h-60 sm:w-60"
    >
      {/* Halo diffus — la teinte suit l'émotion de la scène */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br blur-2xl animate-suta-halo-breathe ${EMOTION_HALO[activeEmotion]}`}
      />

      {/* Ondes sonores (parole en cours) */}
      {isSpeaking &&
        Array.from({ length: WAVE_RING_COUNT }).map((_, index) => (
          <div
            key={index}
            className="absolute h-36 w-36 rounded-full border border-ansut-orange/50 animate-suta-wave sm:h-40 sm:w-40"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}

      {/* Anneau extérieur, rotation lente et continue */}
      <div
        className="absolute h-44 w-44 rounded-full border border-dashed border-ansut-blue/25 animate-suta-ring-slow sm:h-48 sm:w-48"
        aria-hidden="true"
      />

      {/* Anneau intérieur, rotation rapide pendant l'écoute */}
      <div
        className={`absolute h-36 w-36 rounded-full border-2 border-transparent sm:h-40 sm:w-40 ${
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

      {/* Statut court sous l'orbe — seule pastille visible (VoiceStatus reste
          en lecteur d'écran) : une seule voix de statut à l'écran. */}
      <div className="absolute -bottom-2 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ansut-blue shadow-sm">
        {isSpeaking ? "Je vous réponds" : isListening ? "Je vous écoute" : isSearching ? "Je cherche" : state === "CONNECTING" ? "Connexion…" : isError ? "Voix interrompue" : "À votre service"}
      </div>
    </div>
  );
}
