import type { EventConfig } from "@/lib/event-config";

const STARTERS = [
  { label: "Mon village est-il connecte ?", prompt: "Je voudrais savoir si mon village est connecte." },
  { label: "Comment puis-je m'equiper ?", prompt: "Quels dispositifs peuvent m'aider a m'equiper ?" },
  { label: "Ou puis-je me former ?", prompt: "Je voudrais trouver une formation numerique adaptee a ma situation." },
  { label: "Expliquez-moi simplement", prompt: "Pouvez-vous m'expliquer simplement ce qui peut etre utile dans ma situation ?" },
];

/** Accueil conversationnel : on invite a parler, sans transformer SUTA en menu de FAQ. */
export function SutaIntroduction({ event, onStarter }: { event: EventConfig; onStarter?: (prompt: string) => void }) {
  return (
    <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-ansut-orange">SUTA — par l&apos;ANSUT</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ansut-blue sm:text-4xl">Parlez-moi naturellement.</h1>
        <p className="mx-auto mt-2 max-w-xl text-ansut-text-muted">Expliquez-moi votre situation avec vos mots. Je peux vous poser une question, chercher avec vous et garder le fil de notre conversation.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTERS.map((starter) => <button key={starter.label} type="button" onClick={() => onStarter?.(starter.prompt)} className="rounded-full border border-ansut-blue/10 bg-white/80 px-4 py-2 text-xs font-semibold text-ansut-blue shadow-sm transition hover:-translate-y-0.5 hover:border-ansut-orange/40 hover:bg-white">{starter.label}</button>)}
      </div>
      {event.enabled && <div className="mt-1 flex items-center gap-2 rounded-full border border-ansut-border bg-ansut-background px-4 py-1.5 text-xs text-ansut-text-muted"><span className="h-1.5 w-1.5 rounded-full bg-ansut-orange" /><span className="font-medium text-ansut-blue">{event.name}</span>{event.location && <span>· {event.location}</span>}{event.startDate && event.endDate && <span>· {event.startDate} – {event.endDate}</span>}</div>}
    </div>
  );
}
