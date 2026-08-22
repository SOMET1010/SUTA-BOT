"use client";

import { SutaFooter } from "@/components/layout/SutaFooter";
import { SutaHeader } from "@/components/layout/SutaHeader";
import { SalonWelcome } from "@/components/suta/SalonWelcome";
import { SourceDrawer } from "@/components/suta/SourceDrawer";
import { SutaVisualPanel } from "@/components/suta/SutaVisualPanel";
import { SutaVoiceExperience } from "@/components/suta/SutaVoiceExperience";
import { getEventConfig } from "@/lib/event-config";
import { useIdleReset } from "@/lib/use-idle-reset";
import { useKioskMode } from "@/lib/use-kiosk-mode";
import { useSutaConversation } from "@/lib/suta/useSutaConversation";
import type { SutaAction } from "@/lib/suta/visuals";

/** Le salon met en scene le produit citoyen sans creer une application jetable. */
export default function Home() {
  const kiosk = useKioskMode(); const event = getEventConfig(); const controller = useSutaConversation();
  const { state, messages, isLive, scene, pillar, sendText, reset } = controller; useIdleReset(kiosk, reset);
  const lastSutaMessage=[...messages].reverse().find((m)=>m.role==="suta"); const hasScene=Boolean(scene.visual); const pristine=messages.length===0&&state==="IDLE"&&!isLive;
  const handleAction=(action:SutaAction)=>{if(action.prompt)void sendText(action.prompt);};
  return <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-ansut-background">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(0,82,155,0.08),transparent_32%),radial-gradient(circle_at_80%_55%,rgba(242,125,32,0.08),transparent_30%)]" />
    <SutaHeader kiosk={kiosk}/>
    <main className="relative mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-5 py-5 lg:px-10 lg:py-7">
      {kiosk&&pristine ? <div className="flex flex-1 items-center justify-center"><SalonWelcome onStart={(prompt)=>void sendText(prompt)}/></div> : <>
        <div className="mb-4 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-ansut-text-muted">{(["connecter","equiper","former"] as const).map((item)=><span key={item} className={`rounded-full px-3 py-1.5 transition-all ${pillar===item?"bg-ansut-blue text-white shadow-sm":"bg-white/60"}`}>{item}</span>)}</div>
        <div className={`grid min-h-0 flex-1 items-stretch gap-7 transition-[grid-template-columns] duration-500 ease-out ${hasScene?"lg:grid-cols-[minmax(390px,0.82fr)_minmax(520px,1.18fr)]":"lg:grid-cols-[1fr]"}`}><section className="flex min-h-0 items-center justify-center"><SutaVoiceExperience controller={controller} event={event}/></section>{hasScene&&<aside className="min-h-[360px] animate-[suta-scene-in_420ms_ease-out] lg:min-h-0"><SutaVisualPanel visual={scene.visual} onAction={handleAction}/></aside>}</div>
        {lastSutaMessage?.sources?.length?<div className="mx-auto mt-4 w-full max-w-5xl"><SourceDrawer sources={lastSutaMessage.sources}/></div>:null}
      </>}
    </main>
    <SutaFooter kiosk={kiosk}/>{kiosk&&!pristine&&<button type="button" onClick={reset} aria-label="Reinitialiser la demonstration" className="fixed bottom-3 right-3 rounded-full bg-ansut-blue/5 px-3 py-1.5 text-[10px] text-ansut-text-muted hover:bg-ansut-blue/10">Nouvelle conversation</button>}
  </div>;
}
