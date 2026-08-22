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

/** Le salon met en scène le produit citoyen sans créer une application jetable. */
export default function Home() {
  const kiosk = useKioskMode();
  const event = getEventConfig();
  const controller = useSutaConversation();
  const { state, messages, isLive, scene, sendText, reset } = controller;
  useIdleReset(kiosk, reset);

  const lastSutaMessage = [...messages].reverse().find((m) => m.role === "suta");
  const hasScene = Boolean(scene.visual);
  const pristine = messages.length === 0 && state === "IDLE" && !isLive;
  const speaking = state === "SPEAKING";
  const handleAction = (action: SutaAction) => { if (action.prompt) void sendText(action.prompt); };

  return <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-ansut-night text-white">
    {/* Scène de nuit : dégradé bleu nuit + lueur chaude — la profondeur vient
        du fond, pas d'un empilement de cartes (direction de référence). */}
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(53,84,140,0.55),transparent_55%),radial-gradient(ellipse_at_85%_100%,rgba(245,130,32,0.16),transparent_45%),radial-gradient(ellipse_at_0%_85%,rgba(20,42,82,0.8),transparent_55%)]" />
    <SutaHeader kiosk={kiosk}/>
    <main className="relative mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-5 py-4 lg:px-10 lg:py-6">
      {kiosk && pristine ? <div className="flex flex-1 items-center justify-center"><SalonWelcome onStart={(prompt) => void sendText(prompt)}/></div> : <>
        <div className={`grid min-h-0 flex-1 items-stretch gap-7 transition-[grid-template-columns] duration-500 ease-out ${hasScene?"lg:grid-cols-[minmax(390px,0.82fr)_minmax(520px,1.18fr)]":"lg:grid-cols-[1fr]"}`}>
          <section className={`flex min-h-0 items-center justify-center transition-all duration-500 ${speaking && hasScene ? "lg:-translate-x-2" : ""}`}><SutaVoiceExperience controller={controller} event={event}/></section>
          {hasScene && <aside className={`min-h-[360px] transition-all duration-500 lg:min-h-0 ${speaking ? "lg:scale-[1.015]" : "lg:scale-100"}`}><SutaVisualPanel visual={scene.visual} onAction={handleAction} speaking={speaking}/></aside>}
        </div>
        {lastSutaMessage?.sources?.length?<div className="mx-auto mt-4 w-full max-w-5xl"><SourceDrawer sources={lastSutaMessage.sources}/></div>:null}
      </>}
    </main>
    <SutaFooter kiosk={kiosk}/>{kiosk&&!pristine&&<button type="button" onClick={reset} aria-label="Réinitialiser la démonstration" className="fixed bottom-3 right-3 rounded-full bg-white/5 px-3 py-1.5 text-[10px] text-white/50 hover:bg-white/10">Nouvelle conversation</button>}
  </div>;
}
