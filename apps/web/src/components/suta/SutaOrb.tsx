import type { ConversationState } from "@suta/shared";
import type { SutaEmotion } from "@/lib/suta/scene";

const WAVE_RING_COUNT = 3;

const EMOTION_GLOW: Record<SutaEmotion, string> = {
  neutral: "from-ansut-blue-light/45 to-ansut-orange/25",
  warm: "from-ansut-blue-light/55 to-ansut-orange/45",
  curious: "from-ansut-blue-light/70 to-ansut-orange/35",
  thinking: "from-ansut-blue-light/70 to-ansut-blue-light/20",
  explaining: "from-ansut-blue-light/55 to-ansut-orange/45",
  reassuring: "from-ansut-blue-light/45 to-ansut-orange/35",
  celebrating: "from-ansut-orange/65 to-ansut-blue-light/40",
  alert: "from-status-error/55 to-status-error/20",
};

/**
 * Présence SUTA inspirée de la maquette de référence : un personnage ivoirien
 * chaleureux, entouré d'une énergie vocale bleue/orange. SVG pur pour garder
 * le composant léger et réellement dynamique, sans dépendre d'un asset raster.
 */
export function SutaOrb({ state, emotion = "warm" }: { state: ConversationState; emotion?: SutaEmotion }) {
  const isError = state === "ERROR" || state === "OFFLINE";
  const activeEmotion: SutaEmotion = isError ? "alert" : emotion;
  const isListening = state === "LISTENING" || state === "INTERRUPTED";
  const isSpeaking = state === "SPEAKING";
  const isSearching = state === "SEARCHING" || state === "THINKING";

  return (
    <div
      role="img"
      aria-label={`SUTA, état : ${state.toLowerCase()}`}
      data-emotion={activeEmotion}
      className="relative flex h-[22rem] w-[18rem] items-end justify-center sm:h-[25rem] sm:w-[21rem]"
    >
      <div className={`absolute left-1/2 top-[8%] h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br blur-3xl animate-suta-halo-breathe sm:h-72 sm:w-72 ${EMOTION_GLOW[activeEmotion]}`} />

      {isSpeaking && Array.from({ length: WAVE_RING_COUNT }).map((_, index) => (
        <div key={index} className="absolute left-1/2 top-[17%] h-44 w-44 -translate-x-1/2 rounded-full border border-ansut-orange/55 animate-suta-wave sm:h-52 sm:w-52" style={{ animationDelay: `${index * 0.5}s` }} />
      ))}

      <div className="absolute left-1/2 top-[15%] h-52 w-52 -translate-x-1/2 rounded-full border border-dashed border-ansut-blue/25 animate-suta-ring-slow sm:h-60 sm:w-60" />
      <div className={`absolute left-1/2 top-[20%] h-40 w-40 -translate-x-1/2 rounded-full border-2 border-transparent sm:h-48 sm:w-48 ${isListening ? "border-t-ansut-orange animate-suta-ring-fast" : "border-t-ansut-blue/20"}`} />

      <svg viewBox="0 0 280 360" className={`relative z-10 h-[21rem] w-[16.5rem] drop-shadow-[0_24px_36px_rgba(31,56,100,0.22)] sm:h-[24rem] sm:w-[19rem] ${isSpeaking ? "animate-suta-core-pulse" : ""}`} aria-hidden="true">
        <defs>
          <linearGradient id="cap" x1="0" x2="1"><stop stopColor="#173d7a"/><stop offset="1" stopColor="#0d2a58"/></linearGradient>
          <linearGradient id="jacket" x1="0" x2="1"><stop stopColor="#2a5fa8"/><stop offset="1" stopColor="#173d7a"/></linearGradient>
          <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#8d4d2f"/><stop offset=".55" stopColor="#b86c45"/><stop offset="1" stopColor="#7d3f28"/></linearGradient>
          <linearGradient id="shirt" x1="0" x2="1"><stop stopColor="#ffffff"/><stop offset="1" stopColor="#edf3fb"/></linearGradient>
          <filter id="softGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        <g transform="translate(4 2)">
          <path d="M72 338c2-62 18-96 55-105h31c39 8 57 43 58 105Z" fill="url(#jacket)"/>
          <path d="M110 236h65l-8 102h-48Z" fill="url(#shirt)"/>
          <path d="M119 243c8 10 15 14 24 14 10 0 18-5 25-15l-3 97h-43Z" fill="#f8fbff"/>
          <path d="M74 339c4-52 17-82 44-96l7 95Z" fill="#2f68b6"/>
          <path d="M215 339c-4-52-18-82-45-96l-7 95Z" fill="#1a477f"/>
          <path d="M117 241 108 255l12 15 8-24ZM171 241l9 14-13 15-7-24Z" fill="#f58220"/>
          <circle cx="144" cy="295" r="23" fill="#fff" stroke="#1f3864" strokeWidth="7"/>
          <circle cx="144" cy="295" r="11" fill="#f58220"/>

          <ellipse cx="143" cy="155" rx="70" ry="76" fill="url(#skin)"/>
          <ellipse cx="84" cy="164" rx="11" ry="17" fill="#9c5737"/>
          <ellipse cx="202" cy="164" rx="11" ry="17" fill="#8e4a30"/>
          <path d="M92 132c9-36 31-55 55-55 26 0 49 17 58 54-15-13-39-20-59-20-20 0-39 7-54 21Z" fill="#1e1b1b"/>

          <g>
            <ellipse cx="117" cy="155" rx="21" ry="18" fill="#fff"/>
            <ellipse cx="171" cy="155" rx="21" ry="18" fill="#fff"/>
            <circle cx="122" cy="156" r="10" fill="#3b2119"/><circle cx="166" cy="156" r="10" fill="#3b2119"/>
            <circle cx="125" cy="152" r="3.5" fill="#fff"/><circle cx="169" cy="152" r="3.5" fill="#fff"/>
            <path d="M97 138c10-7 23-9 34-3M157 135c11-6 24-4 33 4" fill="none" stroke="#2a1b18" strokeWidth="6" strokeLinecap="round"/>
          </g>
          <path d="M140 162c-3 9-4 18 2 22 4 3 9 1 13-2" fill="none" stroke="#7f3c29" strokeWidth="3" strokeLinecap="round"/>
          <path d="M115 191c17 19 42 20 60-1-4 26-48 31-60 1Z" fill="#5d241c"/>
          <path d="M124 195c13 8 29 8 42-1" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>

          <path d="M86 102c9-30 31-47 59-47 30 0 53 16 61 48Z" fill="url(#cap)"/>
          <path d="M70 104c36-14 82-18 138 1-29 7-77 11-138-1Z" fill="#123565"/>
          <path d="M84 100c18-7 42-12 67-11 23 0 43 4 57 9" fill="none" stroke="#f58220" strokeWidth="4"/>
          <text x="143" y="86" textAnchor="middle" fontSize="24" fontWeight="800" fill="white">ANSUT</text>

          <g filter="url(#softGlow)">
            <circle cx="82" cy="161" r="17" fill="#edf5ff" stroke="#2c6abc" strokeWidth="6"/>
            <circle cx="82" cy="161" r="9" fill="#f58220"/>
            <path d="M76 139c-9-8-6-30 4-40M210 144c8-10 6-30-5-42" fill="none" stroke="#2c6abc" strokeWidth="7" strokeLinecap="round"/>
            <circle cx="207" cy="162" r="15" fill="#edf5ff" stroke="#2c6abc" strokeWidth="6"/>
          </g>

          <path d="M74 292c-25 4-43 18-57 37-5 7 2 17 10 13 17-8 34-15 55-17" fill="url(#skin)"/>
          <path d="M77 293c-15 8-28 16-39 27" fill="none" stroke="#bd7450" strokeWidth="5" strokeLinecap="round"/>
          <path d="M214 301c18 5 31 14 44 29 5 6-1 15-8 12-15-6-29-11-43-11" fill="url(#skin)"/>
        </g>
      </svg>

      {isSearching && <div className="absolute left-1/2 top-[25%] z-20 flex -translate-x-1/2 gap-1 rounded-full bg-white/80 px-3 py-2 shadow-lg backdrop-blur"><span className="h-2 w-2 rounded-full bg-ansut-blue animate-suta-search-pulse"/><span className="h-2 w-2 rounded-full bg-ansut-orange animate-suta-search-pulse [animation-delay:180ms]"/><span className="h-2 w-2 rounded-full bg-ansut-blue animate-suta-search-pulse [animation-delay:360ms]"/></div>}

      <div className="absolute bottom-1 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-ansut-blue/10 bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-ansut-blue shadow-[0_8px_24px_rgba(31,56,100,0.16)] backdrop-blur">
        {isSpeaking ? "Je vous réponds" : isListening ? "Je vous écoute" : isSearching ? "Je cherche" : state === "CONNECTING" ? "Connexion…" : isError ? "Voix interrompue" : "Touchez-moi pour parler"}
      </div>
    </div>
  );
}