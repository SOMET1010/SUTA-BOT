"use client";

import { useState } from "react";
import type { EventConfig } from "@/lib/event-config";
import type { SutaConversationController } from "@/lib/suta/useSutaConversation";
import type { SutaEmotion } from "@/lib/suta/scene";
import { ConversationTranscript } from "./ConversationTranscript";
import { SutaIntroduction } from "./SutaIntroduction";
import { SutaOrb } from "./SutaOrb";
import { SutaRecovery } from "./SutaRecovery";
import { TextComposer } from "./TextComposer";
import { VoiceStatus } from "./VoiceStatus";
import { VoiceVisualizer } from "./VoiceVisualizer";

function emotionForState(state: SutaConversationController["state"]): SutaEmotion {
  switch (state) { case "LISTENING": case "INTERRUPTED": return "curious"; case "THINKING": case "SEARCHING": return "thinking"; case "ERROR": case "OFFLINE": return "alert"; default: return "warm"; }
}

/**
 * Écran voice-first (direction de référence) : SUTA est la présence centrale
 * ET le bouton — toucher l'orbe démarre ou raccroche la voix. Plus de gros
 * bouton micro concurrent, plus de composeur permanent : le clavier est un
 * repli discret (section 54 : la voix ne doit jamais être le seul moyen).
 */
export function SutaVoiceExperience({ controller, event }: { controller: SutaConversationController; event: EventConfig; }) {
  const { state, messages, isLive, scene, pillar, startListening, stopListening, sendText, reset } = controller;
  const [composerOpen, setComposerOpen] = useState(false);
  const emotion = state === "SPEAKING" ? scene.emotion : emotionForState(state);
  const handleOrbPress = () => { if (isLive || state === "LISTENING") { void stopListening(); return; } void startListening(); };
  const isBusy = !isLive && (state === "THINKING" || state === "SEARCHING" || state === "SPEAKING" || state === "CONNECTING");
  const pillarLabel = pillar === "connecter" ? "CONNECTER" : pillar === "equiper" ? "ÉQUIPER" : pillar === "former" ? "FORMER" : pillar === "service-public" ? "SERVICE PUBLIC" : null;
  const hasConversation = messages.length > 0;
  const needsRecovery = state === "ERROR" || state === "OFFLINE";

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-6">
      <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${hasConversation ? "scale-[.86] sm:scale-90" : "scale-100"}`}>
        {hasConversation && pillarLabel && <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-white/80">{pillarLabel}</span>}
        {/* SUTA est le bouton : l'orbe entière démarre/raccroche la voix. */}
        <button
          type="button"
          onClick={handleOrbPress}
          aria-pressed={isLive || state === "LISTENING"}
          aria-label={isLive ? "Raccrocher" : "Activer le microphone — touchez SUTA pour parler"}
          className="group rounded-full transition-transform duration-300 hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ansut-orange focus-visible:outline-offset-8 active:scale-[0.99]"
        >
          <SutaOrb state={state} emotion={emotion} />
        </button>
        {/* La pastille de l'orbe porte le statut visible ; celle-ci reste pour
            les lecteurs d'écran (aria-live) sans doubler l'affichage. */}
        <div className="sr-only"><VoiceStatus state={state} /></div>
        <VoiceVisualizer state={state} />
      </div>
      {!hasConversation ? <SutaIntroduction event={event} onStarter={(prompt) => void sendText(prompt)} /> : <div className="max-h-[34vh] w-full max-w-2xl overflow-auto rounded-[24px] sm:max-h-[40vh]"><ConversationTranscript messages={messages} /></div>}
      {needsRecovery ? <SutaRecovery state={state} onRetry={() => void startListening()} onReset={reset} /> : (
        <div className="flex w-full max-w-xl flex-col items-center gap-3">
          {isLive && <p className="max-w-md text-center text-xs text-white/50">Conversation en cours — parlez naturellement, vous pouvez interrompre SUTA à tout moment.</p>}
          {!isLive && (composerOpen
            ? <div className="w-full animate-[suta-scene-in_260ms_ease-out_both]"><TextComposer onSubmit={(text) => { setComposerOpen(false); void sendText(text); }} disabled={isBusy} /></div>
            : <button type="button" onClick={() => setComposerOpen(true)} className="flex items-center gap-2 rounded-full px-4 py-2 text-xs text-white/45 transition hover:bg-white/5 hover:text-white/75" aria-label="Écrire à SUTA au clavier">
                <KeyboardIcon />
                <span>Écrire plutôt que parler</span>
              </button>
          )}
        </div>
      )}
    </div>
  );
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" />
    </svg>
  );
}
