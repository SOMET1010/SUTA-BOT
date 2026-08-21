"use client";

import { DEMO_QUESTIONS } from "@suta/shared";
import { SutaFooter } from "@/components/layout/SutaFooter";
import { SutaHeader } from "@/components/layout/SutaHeader";
import { SourceDrawer } from "@/components/suta/SourceDrawer";
import { SuggestionGrid } from "@/components/suta/SuggestionGrid";
import { SutaVisualPanel } from "@/components/suta/SutaVisualPanel";
import { SutaVoiceExperience } from "@/components/suta/SutaVoiceExperience";
import { getEventConfig } from "@/lib/event-config";
import { useIdleReset } from "@/lib/use-idle-reset";
import { useKioskMode } from "@/lib/use-kiosk-mode";
import { useSutaConversation } from "@/lib/suta/useSutaConversation";

/**
 * Écran principal SUTA (cahier des charges, section 22) — thème clair
 * ANSUT, disposition 3 colonnes sur grand écran (suggestions / expérience
 * vocale / écran d'appui) conçue pour un affichage Salon en 1920×1080.
 *
 * La colonne de droite porte ce que SUTA montre pendant qu'il parle : la
 * carte du lieu évoqué, puis les sources. Elle est plus large que celle des
 * suggestions — une carte doit se lire de loin, une liste de questions non.
 *
 * Toute l'orchestration (état de conversation, flux WebRTC live vs repli
 * simulé) vit dans `useSutaConversation` — ce composant n'affiche que son
 * état et relaie les interactions (séparation moteur/UI, section 21).
 */
export default function Home() {
  const kiosk = useKioskMode();
  const event = getEventConfig();
  const controller = useSutaConversation();
  const { state, messages, isLive, visual, sendText, reset } = controller;

  useIdleReset(kiosk, reset);

  const isBusy = !isLive && (state === "THINKING" || state === "SEARCHING" || state === "SPEAKING");
  const lastSutaMessage = [...messages].reverse().find((m) => m.role === "suta");

  return (
    <div className="flex flex-1 flex-col bg-ansut-background">
      <SutaHeader kiosk={kiosk} />

      <main className="mx-auto grid w-full flex-1 grid-cols-1 grid-rows-[1fr] gap-6 px-6 py-8 lg:max-w-7xl lg:grid-cols-[240px_1fr_420px] lg:px-10">
        <div className="hidden lg:flex lg:flex-col lg:justify-center">
          <SuggestionGrid
            questions={DEMO_QUESTIONS}
            onSelect={(question) => void sendText(question)}
            disabled={isBusy || isLive}
          />
        </div>

        <SutaVoiceExperience controller={controller} event={event} />

        <div className="hidden min-h-0 lg:flex lg:flex-col lg:gap-4">
          <div className="min-h-0 flex-1">
            <SutaVisualPanel visual={visual} />
          </div>
          <SourceDrawer sources={lastSutaMessage?.sources} />
        </div>

        <div className="flex flex-col gap-6 lg:hidden">
          <SuggestionGrid
            questions={DEMO_QUESTIONS}
            onSelect={(question) => void sendText(question)}
            disabled={isBusy || isLive}
          />
          <div className="h-64">
            <SutaVisualPanel visual={visual} />
          </div>
          <SourceDrawer sources={lastSutaMessage?.sources} />
        </div>
      </main>

      <SutaFooter kiosk={kiosk} />

      {kiosk && (
        <button
          type="button"
          onClick={reset}
          aria-label="Réinitialiser la démonstration"
          className="fixed bottom-3 right-3 rounded-full bg-ansut-blue/5 px-3 py-1.5 text-[10px] text-ansut-text-muted transition-colors hover:bg-ansut-blue/10 hover:text-ansut-blue"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
