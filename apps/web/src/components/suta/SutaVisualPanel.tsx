"use client";

import dynamic from "next/dynamic";
import type { SutaAction, SutaVisual } from "@/lib/suta/visuals";

const SutaMap = dynamic(() => import("./SutaMap"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-ansut-surface" /> });

function ActionRow({ actions, onAction }: { actions?: SutaAction[]; onAction?: (action: SutaAction) => void }) {
  if (!actions?.length) return null;
  return <div className="flex flex-wrap gap-2 border-t border-ansut-border/70 px-5 py-4">{actions.map((action) => (
    <button key={action.id} type="button" onClick={() => onAction?.(action)} disabled={!onAction} className="rounded-full border border-ansut-blue/15 bg-ansut-blue/5 px-4 py-2 text-xs font-semibold text-ansut-blue transition hover:-translate-y-0.5 hover:bg-ansut-blue/10 disabled:cursor-default">{action.label}</button>
  ))}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(14,55,92,0.14)] backdrop-blur-xl animate-[suta-scene-in_420ms_ease-out]">{children}</div>;
}

export function SutaVisualPanel({ visual, onAction }: { visual: SutaVisual | null; onAction?: (action: SutaAction) => void }) {
  if (!visual) return <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-ansut-border/70 bg-white/35 p-8 text-center text-sm text-ansut-text-muted backdrop-blur-sm"><div><div className="mx-auto mb-3 h-2 w-2 rounded-full bg-ansut-orange animate-pulse" /><p>SUTA illustrera sa reponse ici.</p></div></div>;

  if (visual.kind === "map") return <Shell><figure className="flex h-full flex-col"><div className="min-h-0 flex-1"><SutaMap points={visual.points} /></div><figcaption className="border-t border-ansut-border/70 bg-white/95 px-5 py-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">CONNECTER</p><p className="mt-1 font-semibold text-ansut-blue">{visual.caption}</p>{visual.details?.length ? <p className="mt-1 text-xs text-ansut-text-muted">{visual.details.slice(0,2).join(" · ")}</p> : null}</figcaption><ActionRow actions={visual.actions} onAction={onAction} /></figure></Shell>;

  if (visual.kind === "program") return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">{visual.pillar}</span><h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-3 leading-6 text-ansut-text-muted">{visual.summary}</p>{visual.benefits?.length ? <div className="mt-6 grid gap-3">{visual.benefits.slice(0,3).map((item) => <div key={item} className="rounded-2xl bg-ansut-blue/[0.04] p-4 text-sm font-medium text-ansut-blue">{item}</div>)}</div> : null}</div><ActionRow actions={visual.actions} onAction={onAction} /></section></Shell>;

  if (visual.kind === "steps") return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">VOTRE PARCOURS</span><h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3>{visual.summary && <p className="mt-2 text-ansut-text-muted">{visual.summary}</p>}<ol className="mt-6 space-y-4">{visual.steps.map((step,index)=><li key={`${index}-${step.title}`} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ansut-blue font-bold text-white">{index+1}</span><div><p className="font-semibold text-ansut-blue">{step.title}</p>{step.description&&<p className="mt-1 text-sm text-ansut-text-muted">{step.description}</p>}</div></li>)}</ol></div><ActionRow actions={visual.actions} onAction={onAction}/></section></Shell>;

  if (visual.kind === "law-summary") return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">CE QUI CHANGE POUR VOUS</span><h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-3 text-ansut-text-muted">{visual.summary}</p><div className="mt-6 space-y-3">{visual.whatChanges.map((item)=><div key={item} className="rounded-2xl bg-ansut-blue/[0.04] p-4 text-sm">{item}</div>)}</div></div><ActionRow actions={visual.actions} onAction={onAction}/></section></Shell>;

  if (visual.kind === "alert") return <Shell><section className="flex h-full flex-col"><div className="flex flex-1 flex-col justify-center p-8"><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">INFORMATION IMPORTANTE</span><h3 className="mt-3 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-4 leading-6 text-ansut-text-muted">{visual.message}</p></div><ActionRow actions={visual.actions} onAction={onAction}/></section></Shell>;

  return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7">{visual.eyebrow&&<span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">{visual.eyebrow}</span>}<h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-3 leading-6 text-ansut-text-muted">{visual.summary}</p>{visual.facts?.length?<dl className="mt-6 grid gap-3">{visual.facts.slice(0,3).map((fact)=><div key={fact.label} className="rounded-2xl bg-ansut-blue/[0.04] p-4"><dt className="text-xs text-ansut-text-muted">{fact.label}</dt><dd className="mt-1 font-semibold text-ansut-blue">{fact.value}</dd></div>)}</dl>:null}</div><ActionRow actions={visual.actions} onAction={onAction}/></section></Shell>;
}
