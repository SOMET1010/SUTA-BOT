import type { TranscriptSource } from "@/lib/suta/useSutaConversation";

/**
 * Panneau des sources de la dernière réponse (cahier des charges, section
 * 38 : chaque réponse doit pouvoir être tracée à un document). Affiché en
 * colonne latérale — reste vide tant qu'aucune réponse sourcée n'a été
 * donnée (jamais de source inventée).
 */
export function SourceDrawer({ sources }: { sources?: TranscriptSource[] }) {
  return (
    <aside className="flex w-full flex-col gap-3 rounded-2xl border border-ansut-border bg-ansut-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-ansut-text-muted">
        Sources
      </h2>

      {!sources || sources.length === 0 ? (
        <p className="text-sm text-ansut-text-muted">
          Les sources de la réponse s&apos;afficheront ici.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {sources.map((source, index) => (
            <li
              key={`${source.source}-${index}`}
              className="rounded-lg border border-ansut-border bg-ansut-background px-3 py-2 text-ansut-blue"
            >
              <p className="font-medium">{source.title}</p>
              <p className="text-xs text-ansut-text-muted">{source.source}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
