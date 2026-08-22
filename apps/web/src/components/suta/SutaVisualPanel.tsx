"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { SutaAction, SutaVisual } from "@/lib/suta/visuals";

const SutaMap = dynamic(() => import("./SutaMap"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-ansut-surface" /> });

function ActionRow({ actions, onAction, visible = true }: { actions?: SutaAction[]; onAction?: (action: SutaAction) => void; visible?: boolean }) {
  if (!actions?.length || !visible) return null;
  return <div className="flex flex-wrap gap-2 border-t border-ansut-border/70 px-5 py-4 animate-[suta-scene-in_320ms_ease-out]">{actions.map((action) => (
    <button key={action.id} type="button" onClick={() => onAction?.(action)} disabled={!onAction} className="rounded-full border border-ansut-blue/15 bg-ansut-blue/5 px-4 py-2 text-xs font-semibold text-ansut-blue transition hover:-translate-y-0.5 hover:bg-ansut-blue/10 disabled:cursor-default">{action.label}</button>
  ))}</div>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="relative h-full overflow-hidden rounded-[28px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(14,55,92,0.14)] backdrop-blur-xl animate-[suta-scene-in_420ms_ease-out] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-ansut-orange/50 before:to-transparent">{children}</div>;
}

function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return <div className="animate-[suta-scene-in_380ms_ease-out]">{children}</div>;
}

export function SutaVisualPanel({ visual, onAction, speaking = false }: { visual: SutaVisual | null; onAction?: (action: SutaAction) => void; speaking?: boolean }) {
  const visualKey = useMemo(() => visual ? JSON.stringify(visual).slice(0, 240) : "empty", [visual]);
  const [stage, setStage] = useState(3);

  useEffect(() => {
    setStage(0);
    const timers = [
      window.setTimeout(() => setStage(1), speaking ? 220 : 80),
      window.setTimeout(() => setStage(2), speaking ? 850 : 240),
      window.setTimeout(() => setStage(3), speaking ? 1550 : 420),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [visualKey, speaking]);

  if (!visual) return <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-ansut-border/70 bg-white/35 p-8 text-center text-sm text-ansut-text-muted backdrop-blur-sm"><div><div className="mx-auto mb-3 h-2 w-2 rounded-full bg-ansut-orange animate-pulse" /><p>SUTA illustrera sa reponse ici.</p></div></div>;

  if (visual.kind === "map") return <Shell><figure className="flex h-full flex-col"><div className="relative min-h-0 flex-1"><SutaMap points={visual.points} />{speaking && <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-ansut-blue shadow-sm">SUTA vous montre</div>}</div><Reveal show={stage >= 1}><figcaption className="border-t border-ansut-border/70 bg-white/95 px-5 py-3"><p className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">CONNECTER</p><p className="mt-1 font-semibold text-ansut-blue">{visual.caption}</p>{stage >= 2 && visual.details?.length ? <p className="mt-1 text-xs text-ansut-text-muted">{visual.details.slice(0,2).join(" · ")}</p> : null}</figcaption></Reveal><ActionRow actions={visual.actions} onAction={onAction} visible={stage >= 3} /></figure></Shell>;

  if (visual.kind === "program") return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><Reveal show={stage >= 1}><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">{visual.pillar}</span><h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-3 leading-6 text-ansut-text-muted">{visual.summary}</p></Reveal>{stage >= 2 && visual.benefits?.length ? <div className="mt-6 grid gap-3">{visual.benefits.slice(0,3).map((item,index) => <div key={item} style={{ animationDelay: `${index * 120}ms` }} className="rounded-2xl bg-ansut-blue/[0.04] p-4 text-sm font-medium text-ansut-blue animate-[suta-scene-in_380ms_ease-out_both]">{item}</div>)}</div> : null}</div><ActionRow actions={visual.actions} onAction={onAction} visible={stage >= 3} /></section></Shell>;

  if (visual.kind === "steps") return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><Reveal show={stage >= 1}><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">VOTRE PARCOURS</span><h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3>{visual.summary && <p className="mt-2 text-ansut-text-muted">{visual.summary}</p>}</Reveal>{stage >= 2 && <ol className="mt-6 space-y-4">{visual.steps.map((step,index)=><li key={`${index}-${step.title}`} style={{ animationDelay: `${index * 140}ms` }} className="flex gap-4 animate-[suta-scene-in_400ms_ease-out_both]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ansut-blue font-bold text-white">{index+1}</span><div><p className="font-semibold text-ansut-blue">{step.title}</p>{step.description&&<p className="mt-1 text-sm text-ansut-text-muted">{step.description}</p>}</div></li>)}</ol>}</div><ActionRow actions={visual.actions} onAction={onAction} visible={stage >= 3}/></section></Shell>;

  if (visual.kind === "law-summary") return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><Reveal show={stage >= 1}><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">CE QUI CHANGE POUR VOUS</span><h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-3 text-ansut-text-muted">{visual.summary}</p></Reveal>{stage >= 2 && <div className="mt-6 space-y-3">{visual.whatChanges.map((item,index)=><div key={item} style={{ animationDelay: `${index * 120}ms` }} className="rounded-2xl bg-ansut-blue/[0.04] p-4 text-sm animate-[suta-scene-in_380ms_ease-out_both]">{item}</div>)}</div>}</div><ActionRow actions={visual.actions} onAction={onAction} visible={stage >= 3}/></section></Shell>;

  if (visual.kind === "alert") return <Shell><section className="flex h-full flex-col"><div className="flex flex-1 flex-col justify-center p-8"><Reveal show={stage >= 1}><span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">INFORMATION IMPORTANTE</span><h3 className="mt-3 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-4 leading-6 text-ansut-text-muted">{visual.message}</p></Reveal></div><ActionRow actions={visual.actions} onAction={onAction} visible={stage >= 3}/></section></Shell>;

  return <Shell><section className="flex h-full flex-col"><div className="flex-1 overflow-auto p-7"><Reveal show={stage >= 1}>{visual.eyebrow&&<span className="text-xs font-bold uppercase tracking-[0.18em] text-ansut-orange">{visual.eyebrow}</span>}<h3 className="mt-2 text-2xl font-semibold text-ansut-blue">{visual.title}</h3><p className="mt-3 leading-6 text-ansut-text-muted">{visual.summary}</p></Reveal>{stage >= 2 && visual.facts?.length?<dl className="mt-6 grid gap-3">{visual.facts.slice(0,3).map((fact,index)=><div key={fact.label} style={{ animationDelay: `${index * 120}ms` }} className="rounded-2xl bg-ansut-blue/[0.04] p-4 animate-[suta-scene-in_380ms_ease-out_both]"><dt className="text-xs text-ansut-text-muted">{fact.label}</dt><dd className="mt-1 font-semibold text-ansut-blue">{fact.value}</dd></div>)}</dl>:null}</div><ActionRow actions={visual.actions} onAction={onAction} visible={stage >= 3}/></section></Shell>;
}
