"use client";

import type { EventConfig } from "@/lib/event-config";
import type { SutaConversationController } from "@/lib/suta/useSutaConversation";
import type { SutaEmotion } from "@/lib/suta/scene";
import { ConversationTranscript } from "./ConversationTranscript";
import { MicrophoneButton } from "./MicrophoneButton";
import { SutaIntroduction } from "./SutaIntroduction";
import { SutaOrb } from "./SutaOrb";
import { SutaRecovery } from "./SutaRecovery";
import { TextComposer } from "./TextComposer";
import { VoiceStatus } from "./VoiceStatus";
import { VoiceVisualizer } from "./VoiceVisualizer";

function emotionForState(state: SutaConversationController["state"]): SutaEmotion {
  switch (state) { case "LISTENING": case "INTERRUPTED": return "curious"; case "THINKING": case "SEARCHING": return "thinking"; case "ERROR": case "OFFLINE": return "alert"; default: return "warm"; }
}

export function SutaVoiceExperience({ controller, event }: { controller: SutaConversationController; event: EventConfig; }) {
  const { state, messages, isLive, scene, pillar, startListening, stopListening, sendText, reset } = controller;
  const emotion = state === "SPEAKING" ? scene.emotion : emotionForState(state);
  const handleMicPress = () => { if (isLive || state === "LISTENING") { void stopListening(); return; } void startListening(); };
  const isBusy = !isLive && (state === "THINKING" || state === "SEARCHING" || state === "SPEAKING" || state === "CONNECTING");
  const pillarLabel = pillar === "connecter" ? "CONNECTER" : pillar === "equiper" ? "ÉQUIPER" : pillar === "former" ? "FORMER" : pillar === "service-public" ? "SERVICE PUBLIC" : null;
  const hasConversation = messages.length > 0;
  const needsRecovery = state === "ERROR" || state === "OFFLINE";

  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-8">
      <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${hasConversation ? "scale-[.86] sm:scale-90" : "scale-100"}`}>
        {pillarLabel && <span className="rounded-full border border-ansut-blue/15 bg-white/80 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-ansut-blue shadow-sm">{pillarLabel}</span>}
        <SutaOrb state={state} emotion={emotion} />
        {/* La pastille de l'orbe porte le statut visible ; celle-ci reste pour
            les lecteurs d'écran (aria-live) sans doubler l'affichage. */}
        <div className="sr-only"><VoiceStatus state={state} /></div>
        <VoiceVisualizer state={state} />
      </div>
      {!hasConversation ? <SutaIntroduction event={event} onStarter={(prompt) => void sendText(prompt)} /> : <div className="max-h-[32vh] w-full max-w-2xl overflow-auto rounded-[24px] sm:max-h-[38vh]"><ConversationTranscript messages={messages} /></div>}
      {needsRecovery ? <SutaRecovery state={state} onRetry={() => void startListening()} onReset={reset} /> : <div className="flex w-full max-w-xl flex-col items-center gap-4"><MicrophoneButton state={state} onPress={handleMicPress} liveCallActive={isLive} />{!isLive && <div className="w-full"><TextComposer onSubmit={(text) => void sendText(text)} disabled={isBusy} /></div>}{isLive && <p className="max-w-md text-center text-xs text-ansut-text-muted">Conversation en cours — parlez naturellement, vous pouvez interrompre SUTA à tout moment.</p>}</div>}
    </div>
  );
}
