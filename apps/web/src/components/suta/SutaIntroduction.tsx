import type { EventConfig } from "@/lib/event-config";

const STARTERS = [
  { label: "Mon village est-il connecté ?", prompt: "Je voudrais savoir si mon village est connecté." },
  { label: "Comment puis-je m'équiper ?", prompt: "Quels dispositifs peuvent m'aider à m'équiper ?" },
  { label: "Où puis-je me former ?", prompt: "Je voudrais trouver une formation numérique adaptée à ma situation." },
  { label: "Expliquez-moi simplement", prompt: "Pouvez-vous m'expliquer simplement ce qui peut être utile dans ma situation ?" },
];

/**
 * Accueil voice-first : une seule invitation, presque pas de texte — la
 * présence de SUTA porte l'écran (direction de référence). Les amorces
 * restent, discrètes, pour guider un visiteur de salon qui hésite.
 */
export function SutaIntroduction({ event, onStarter }: { event: EventConfig; onStarter?: (prompt: string) => void }) {
  return (
    <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Parlez-moi, je vous écoute.</h1>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-center">
        {STARTERS.map((starter) => <button key={starter.label} type="button" onClick={() => onStarter?.(starter.prompt)} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-medium text-white/75 backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-ansut-orange/50 hover:bg-white/10 hover:text-white sm:rounded-full sm:px-4 sm:text-xs">{starter.label}</button>)}
      </div>
      {event.enabled && <div className="mt-1 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/55"><span className="h-1.5 w-1.5 rounded-full bg-ansut-orange" /><span className="font-medium text-white/85">{event.name}</span>{event.location && <span>· {event.location}</span>}{event.startDate && event.endDate && <span>· {event.startDate} – {event.endDate}</span>}</div>}
    </div>
  );
}
