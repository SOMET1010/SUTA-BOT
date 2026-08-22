"use client";

import dynamic from "next/dynamic";
import type { SutaVisual } from "@/lib/suta/visuals";

const SutaMap = dynamic(() => import("./SutaMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-ansut-surface" />,
});

function ActionRow({ actions }: { actions?: Array<{ id: string; label: string }> }) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-ansut-border px-4 py-3">
      {actions.map((action) => (
        <span key={action.id} className="rounded-full border border-ansut-border bg-white px-3 py-1.5 text-xs font-medium text-ansut-blue">
          {action.label}
        </span>
      ))}
    </div>
  );
}

export function SutaVisualPanel({ visual }: { visual: SutaVisual | null }) {
  if (!visual) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-ansut-border bg-ansut-surface/50 p-6 text-center text-sm text-ansut-text-muted">
        SUTA illustrera sa reponse ici.
      </div>
    );
  }

  if (visual.kind === "map") {
    return (
      <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-ansut-border bg-ansut-surface">
        <div className="min-h-0 flex-1"><SutaMap points={visual.points} /></div>
        <figcaption className="border-t border-ansut-border px-4 py-2 text-sm font-medium text-ansut-blue">{visual.caption}</figcaption>
        <ActionRow actions={visual.actions} />
      </figure>
    );
  }

  if (visual.kind === "steps") {
    return (
      <section className="h-full overflow-auto rounded-2xl border border-ansut-border bg-white p-5">
        <h3 className="text-lg font-semibold text-ansut-blue">{visual.title}</h3>
        {visual.summary && <p className="mt-1 text-sm text-ansut-text-muted">{visual.summary}</p>}
        <ol className="mt-4 space-y-3">
          {visual.steps.map((step, index) => (
            <li key={`${index}-${step.title}`} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ansut-blue text-xs font-bold text-white">{index + 1}</span>
              <div><p className="font-medium text-ansut-blue">{step.title}</p>{step.description && <p className="text-sm text-ansut-text-muted">{step.description}</p>}</div>
            </li>
          ))}
        </ol>
        <ActionRow actions={visual.actions} />
      </section>
    );
  }

  if (visual.kind === "program") {
    return (
      <section className="h-full overflow-auto rounded-2xl border border-ansut-border bg-white p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ansut-orange">{visual.pillar}</span>
        <h3 className="mt-1 text-lg font-semibold text-ansut-blue">{visual.title}</h3>
        <p className="mt-2 text-sm text-ansut-text-muted">{visual.summary}</p>
        {visual.benefits?.length ? <ul className="mt-4 space-y-2 text-sm">{visual.benefits.map((item) => <li key={item}>• {item}</li>)}</ul> : null}
        <ActionRow actions={visual.actions} />
      </section>
    );
  }

  if (visual.kind === "law-summary") {
    return (
      <section className="h-full overflow-auto rounded-2xl border border-ansut-border bg-white p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ansut-orange">Ce qui change pour vous</span>
        <h3 className="mt-1 text-lg font-semibold text-ansut-blue">{visual.title}</h3>
        <p className="mt-2 text-sm text-ansut-text-muted">{visual.summary}</p>
        <ul className="mt-4 space-y-2 text-sm">{visual.whatChanges.map((item) => <li key={item}>• {item}</li>)}</ul>
        <ActionRow actions={visual.actions} />
      </section>
    );
  }

  if (visual.kind === "alert") {
    return (
      <section className="h-full rounded-2xl border border-ansut-border bg-white p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-ansut-orange">Information importante</span>
        <h3 className="mt-1 text-lg font-semibold text-ansut-blue">{visual.title}</h3>
        <p className="mt-3 text-sm text-ansut-text-muted">{visual.message}</p>
        <ActionRow actions={visual.actions} />
      </section>
    );
  }

  return (
    <section className="h-full overflow-auto rounded-2xl border border-ansut-border bg-white p-5">
      {visual.eyebrow && <span className="text-xs font-semibold uppercase tracking-wide text-ansut-orange">{visual.eyebrow}</span>}
      <h3 className="mt-1 text-lg font-semibold text-ansut-blue">{visual.title}</h3>
      <p className="mt-2 text-sm text-ansut-text-muted">{visual.summary}</p>
      {visual.facts?.length ? <dl className="mt-4 space-y-2">{visual.facts.map((fact) => <div key={fact.label} className="flex justify-between gap-4 text-sm"><dt className="text-ansut-text-muted">{fact.label}</dt><dd className="font-medium text-ansut-blue">{fact.value}</dd></div>)}</dl> : null}
      <ActionRow actions={visual.actions} />
    </section>
  );
}
