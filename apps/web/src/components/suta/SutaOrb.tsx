import type { ConversationState } from "@suta/shared";
import type { SutaEmotion } from "@/lib/suta/scene";

const WAVE_RING_COUNT = 3;

const EMOTION_STYLES: Record<
  SutaEmotion,
  { halo: string; core: string; accent: string; label: string }
> = {
  neutral: {
    halo: "from-ansut-blue/20 to-ansut-orange/15",
    core: "from-ansut-blue to-ansut-orange",
    accent: "border-t-ansut-blue/30",
    label: "calme",
  },
  warm: {
    halo: "from-ansut-orange/25 to-ansut-blue/20",
    core: "from-ansut-orange to-ansut-blue",
    accent: "border-t-ansut-orange",
    label: "accueillant",
  },
  curious: {
    halo: "from-ansut-blue/30 to-cyan-300/20",
    core: "from-ansut-blue to-cyan-500",
    accent: "border-t-cyan-400",
    label: "curieux",
  },
  thinking: {
    halo: "from-indigo-300/25 to-ansut-blue/25",
    core: "from-indigo-500 to-ansut-blue",
    accent: "border-t-indigo-400",
    label: "en reflexion",
  },
  explaining: {
    halo: "from-ansut-blue/30 to-ansut-orange/25",
    core: "from-ansut-blue to-ansut-orange",
    accent: "border-t-ansut-orange",
    label: "pedagogue",
  },
  reassuring: {
    halo: "from-emerald-300/25 to-ansut-blue/20",
    core: "from-emerald-500 to-ansut-blue",
    accent: "border-t-emerald-400",
    label: "rassurant",
  },
  celebrating: {
    halo: "from-amber-300/35 to-ansut-orange/30",
    core: "from-amber-400 to-ansut-orange",
    accent: "border-t-amber-400",
    label: "enthousiaste",
  },
  alert: {
    halo: "from-red-300/25 to-ansut-orange/20",
    core: "from-red-500 to-ansut-orange",
    accent: "border-t-red-400",
    label: "alerte",
  },
};

/**
 * Presence visuelle de SUTA. L'etat technique pilote le rythme tandis que
 * l'emotion pilote la couleur et la tonalite visuelle.
 */
export function SutaOrb({
  state,
  emotion = "warm",
}: {
  state: ConversationState;
  emotion?: SutaEmotion;
}) {
  const isError = state === "ERROR" || state === "OFFLINE";
  const isListening = state === "LISTENING" || state === "INTERRUPTED";
  const isSpeaking = state === "SPEAKING";
  const isSearching = state === "SEARCHING" || state === "THINKING";
  const style = isError ? EMOTION_STYLES.alert : EMOTION_STYLES[emotion];

  return (
    <div
      role="img"
      aria-label={`Avatar SUTA, etat ${state.toLowerCase()}, emotion ${style.label}`}
      className="relative flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56"
      data-emotion={isError ? "alert" : emotion}
    >
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${style.halo} blur-2xl animate-suta-halo-breathe`}
      />

      {isSpeaking &&
        Array.from({ length: WAVE_RING_COUNT }).map((_, index) => (
          <div
            key={index}
            className="absolute h-32 w-32 rounded-full border border-ansut-orange/50 animate-suta-wave sm:h-36 sm:w-36"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}

      <div
        className="absolute h-40 w-40 rounded-full border border-dashed border-ansut-blue/25 animate-suta-ring-slow sm:h-44 sm:w-44"
        aria-hidden="true"
      />

      <div
        className={`absolute h-32 w-32 rounded-full border-2 border-transparent sm:h-36 sm:w-36 ${
          isListening ? `${style.accent} animate-suta-ring-fast` : style.accent
        }`}
        aria-hidden="true"
      />

      <div
        className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${style.core} shadow-lg animate-suta-core-pulse sm:h-28 sm:w-28`}
      >
        {isSearching && (
          <span className="h-3 w-3 rounded-full bg-white animate-suta-search-pulse" />
        )}
        {isSpeaking && emotion === "celebrating" && (
          <span className="absolute -right-2 -top-2 text-lg" aria-hidden="true">
            ✨
          </span>
        )}
      </div>
    </div>
  );
}
