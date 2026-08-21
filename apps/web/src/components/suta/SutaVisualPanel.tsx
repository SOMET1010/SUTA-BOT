"use client";

import dynamic from "next/dynamic";
import type { SutaVisual } from "@/lib/suta/visuals";

/**
 * L'écran qui accompagne la parole de SUTA.
 *
 * Chargé côté navigateur uniquement : Leaflet touche à `window` dès son
 * import et ne peut pas être rendu sur le serveur.
 */
const SutaMap = dynamic(() => import("./SutaMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-ansut-surface" />,
});

export function SutaVisualPanel({ visual }: { visual: SutaVisual | null }) {
  if (!visual) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ansut-border bg-ansut-surface/50 p-6 text-center text-sm text-ansut-text-muted">
        Quand SUTA évoque un lieu, la carte s&apos;affiche ici.
      </div>
    );
  }

  return (
    <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-ansut-border bg-ansut-surface">
      <div className="min-h-0 flex-1">
        <SutaMap points={visual.points} />
      </div>
      <figcaption className="border-t border-ansut-border px-4 py-2 text-sm font-medium text-ansut-blue">
        {visual.caption}
      </figcaption>
    </figure>
  );
}
