"use client";

const PERSONAS = [
  { label: "Citoyen", prompt: "Je suis un citoyen. Aide-moi à comprendre ce que les services publics peuvent faire concrètement pour moi." },
  { label: "Habitant d'une localité", prompt: "Je veux savoir si ma localité est connectée et ce que je peux y faire avec le numérique." },
  { label: "Entrepreneur", prompt: "Je suis entrepreneur. Quels dispositifs numériques publics peuvent être utiles à mon activité ?" },
  { label: "Parent", prompt: "Je cherche des solutions pour aider ma famille à s'équiper et à se former au numérique." },
];

export function SalonWelcome({ onStart }: { onStart: (prompt: string) => void }) {
  return <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center animate-[suta-scene-in_500ms_ease-out]">
    <div className="rounded-full border border-ansut-orange/30 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-ansut-orange">Expérience Impact IA</div>
    <div><h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">Et si le service public vous répondait simplement ?</h1><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-white/60 sm:text-lg">Parlez à SUTA comme vous parleriez à quelqu&apos;un. Commencez par votre situation, pas par le nom d&apos;une administration.</p></div>
    <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">{PERSONAS.map((persona)=><button key={persona.label} type="button" onClick={()=>onStart(persona.prompt)} className="min-h-24 rounded-[24px] border border-white/10 bg-white/[0.06] p-4 text-left font-semibold text-white backdrop-blur-sm transition hover:-translate-y-1 hover:border-ansut-orange/50 hover:bg-white/10"><span className="text-[10px] uppercase tracking-[.16em] text-ansut-orange">Je suis</span><span className="mt-2 block">{persona.label}</span></button>)}</div>
    <p className="text-xs text-white/45">Ou touchez SUTA et dites simplement ce que vous cherchez.</p>
  </div>;
}
