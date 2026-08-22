import type { ConversationState } from "@suta/shared";
import type { SutaEmotion } from "@/lib/suta/scene";

const WAVE_RING_COUNT = 3;
const LABELS: Record<SutaEmotion,string> = { neutral:"calme", warm:"accueillant", curious:"curieux", thinking:"en reflexion", explaining:"pedagogue", reassuring:"rassurant", celebrating:"enthousiaste", alert:"alerte" };

/** Avatar vectoriel SUTA sans asset externe : le visage peut ensuite etre remplace par l'asset 3D officiel. */
export function SutaOrb({ state, emotion="warm" }: { state: ConversationState; emotion?: SutaEmotion }) {
  const isError=state==="ERROR"||state==="OFFLINE"; const activeEmotion=isError?"alert":emotion;
  const isListening=state==="LISTENING"||state==="INTERRUPTED"; const isSpeaking=state==="SPEAKING"; const isThinking=state==="SEARCHING"||state==="THINKING";
  return <div role="img" aria-label={`SUTA, ${LABELS[activeEmotion]}`} data-emotion={activeEmotion} className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
    <div className="absolute inset-3 rounded-full bg-gradient-to-br from-ansut-blue/20 via-white to-ansut-orange/25 blur-2xl animate-suta-halo-breathe" />
    {isSpeaking&&Array.from({length:WAVE_RING_COUNT}).map((_,i)=><div key={i} className="absolute h-40 w-40 rounded-full border border-ansut-orange/45 animate-suta-wave" style={{animationDelay:`${i*.5}s`}} />)}
    <div className={`absolute h-48 w-48 rounded-full border border-dashed border-ansut-blue/25 ${isListening?"animate-suta-ring-fast":"animate-suta-ring-slow"}`} />
    <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-white bg-gradient-to-b from-sky-100 to-blue-50 shadow-[0_20px_60px_rgba(10,55,110,.22)]">
      <div className="absolute left-1/2 top-3 h-20 w-28 -translate-x-1/2 rounded-[50%_50%_46%_46%] bg-[#7a431f]" />
      <div className="absolute left-1/2 top-0 h-11 w-32 -translate-x-1/2 rounded-b-[55%] rounded-t-full bg-ansut-blue shadow-md"><span className="absolute left-1/2 top-3 -translate-x-1/2 text-[10px] font-black tracking-wider text-white">ANSUT</span><span className="absolute bottom-0 left-2 right-2 h-1 rounded-full bg-ansut-orange" /></div>
      <div className="absolute left-[42px] top-[62px] h-5 w-5 rounded-full bg-white shadow-inner"><span className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-[#18243a] ${isThinking?"animate-pulse":""}`} /></div>
      <div className="absolute right-[42px] top-[62px] h-5 w-5 rounded-full bg-white shadow-inner"><span className={`absolute left-1 top-1 h-3 w-3 rounded-full bg-[#18243a] ${isThinking?"animate-pulse":""}`} /></div>
      <div className={`absolute left-1/2 top-[92px] -translate-x-1/2 border-[#3b1f16] ${activeEmotion==="celebrating"||activeEmotion==="warm"?"h-5 w-10 rounded-b-full border-b-4":"h-3 w-8 rounded-full border-b-2"}`} />
      <div className="absolute -bottom-12 left-1/2 h-24 w-28 -translate-x-1/2 rounded-t-[45%] bg-ansut-blue"><span className="absolute left-1/2 top-4 h-7 w-7 -translate-x-1/2 rounded-full border-[5px] border-white bg-ansut-orange" /></div>
      {isThinking&&<div className="absolute inset-0 bg-white/10 animate-pulse" />}
    </div>
    <div className="absolute -bottom-1 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.14em] text-ansut-blue shadow-sm">{isSpeaking?"Je vous reponds":isListening?"Je vous ecoute":isThinking?"Je cherche":"SUTA est pret"}</div>
  </div>;
}
