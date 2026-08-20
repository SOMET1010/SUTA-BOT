import type { ConversationState } from "@suta/shared";

const BAR_COUNT = 5;
const BAR_DELAYS = ["0s", "0.12s", "0.24s", "0.12s", "0s"];

/**
 * Visualiseur d'activité vocale — animation stylisée liée à l'état de la
 * conversation (LISTENING/SPEAKING), pas une amplitude réelle du micro :
 * aucune donnée n'est fabriquée, c'est un indicateur purement décoratif.
 */
export function VoiceVisualizer({ state }: { state: ConversationState }) {
  const active = state === "LISTENING" || state === "SPEAKING" || state === "INTERRUPTED";

  if (!active) return null;

  return (
    <div
      className="flex h-6 items-end justify-center gap-1"
      role="presentation"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }).map((_, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-ansut-orange animate-suta-bar"
          style={{ height: "100%", animationDelay: BAR_DELAYS[index] }}
        />
      ))}
    </div>
  );
}
