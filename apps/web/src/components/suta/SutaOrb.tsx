import Image from "next/image";
import type { ConversationState } from "@suta/shared";
import type { SutaEmotion } from "@/lib/suta/scene";

const WAVE_RING_COUNT = 3;

/**
 * Présence SUTA — le visuel de référence officiel (mascotte 3D, casquette
 * ANSUT, casque audio) servi tel quel depuis /suta/hero/suta-reference.png,
 * jamais redessiné. L'image est cadrée en médaillon circulaire par CSS
 * (object-position sur le visage) : son fond clair de capture reste hors
 * champ et la présence s'enchâsse dans le dispositif vivant — halo
 * émotionnel, anneaux d'écoute, ondes de parole. L'orbe entière est le
 * bouton vocal (SutaVoiceExperience l'enveloppe d'un <button>).
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
      className="relative flex h-60 w-60 items-center justify-center sm:h-72 sm:w-72 lg:h-96 lg:w-96"
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
            className="absolute h-48 w-48 rounded-full border border-ansut-orange/60 animate-suta-wave sm:h-56 sm:w-56 lg:h-80 lg:w-80"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}

      {/* Anneau extérieur, rotation lente et continue */}
      <div
        className="absolute h-56 w-56 rounded-full border border-dashed border-white/20 animate-suta-ring-slow sm:h-64 sm:w-64 lg:h-[22rem] lg:w-[22rem]"
        aria-hidden="true"
      />

      {/* Anneau intérieur, rotation rapide pendant l'écoute */}
      <div
        className={`absolute h-48 w-48 rounded-full border-2 border-transparent sm:h-56 sm:w-56 lg:h-80 lg:w-80 ${
          isListening ? "border-t-ansut-orange animate-suta-ring-fast" : "border-t-white/15"
        }`}
        aria-hidden="true"
      />

      {/* Médaillon : le visuel de référence, cadré sur le visage. */}
      <div
        className={`relative h-44 w-44 overflow-hidden rounded-full border-2 sm:h-52 sm:w-52 lg:h-72 lg:w-72 ${
          isError
            ? "border-status-error/70 shadow-[0_0_60px_rgba(198,40,40,0.4)]"
            : "border-white/25 shadow-[0_0_80px_rgba(245,130,32,0.35)]"
        } ${isSpeaking ? "animate-suta-core-pulse" : ""}`}
      >
        <Image
          src="/suta/hero/suta-reference.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 18rem, (min-width: 640px) 13rem, 11rem"
          className="object-cover object-[50%_12%]"
        />
        {/* Voile nuit sur le bord bas du médaillon pour fondre l'image dans la scène. */}
        <div aria-hidden="true" className="absolute inset-0 rounded-full bg-gradient-to-t from-ansut-night/45 via-transparent to-transparent" />
      </div>

      {/* Réflexion / recherche en cours */}
      {isSearching && (
        <div className="absolute bottom-9 z-20 flex gap-1 rounded-full bg-white/90 px-3 py-1.5 shadow-lg sm:bottom-11">
          <span className="h-1.5 w-1.5 rounded-full bg-ansut-blue animate-suta-search-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-ansut-orange animate-suta-search-pulse [animation-delay:180ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-ansut-blue animate-suta-search-pulse [animation-delay:360ms]" />
        </div>
      )}

      {/* Invite / statut — l'orbe est le bouton, la pastille le dit. */}
      <div className="absolute -bottom-2 z-20 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-sm">
        {isSpeaking ? "Je vous réponds" : isListening ? "Je vous écoute" : isSearching ? "Je cherche" : state === "CONNECTING" ? "Connexion…" : isError ? "Voix interrompue" : "Touchez-moi pour parler"}
      </div>
    </div>
  );
}
