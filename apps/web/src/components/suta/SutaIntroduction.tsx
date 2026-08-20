import type { EventConfig } from "@/lib/event-config";

/**
 * Écran d'accueil (avant toute question) : titre, sous-titre, et encart
 * événement optionnel — masqué tant que `SALON_EVENT_ENABLED` n'est pas
 * explicitement activé (aucune donnée événementielle inventée).
 */
export function SutaIntroduction({ event }: { event: EventConfig }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-ansut-blue sm:text-4xl">SUTA</h1>
      <p className="max-w-md text-ansut-text-muted">Comment puis-je vous aider ?</p>

      {event.enabled && (
        <div className="mt-1 flex items-center gap-2 rounded-full border border-ansut-border bg-ansut-background px-4 py-1.5 text-xs text-ansut-text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-ansut-orange" />
          <span className="font-medium text-ansut-blue">{event.name}</span>
          {event.location && <span>· {event.location}</span>}
          {event.startDate && event.endDate && (
            <span>
              · {event.startDate} – {event.endDate}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
