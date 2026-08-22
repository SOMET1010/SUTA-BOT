"use client";

import type { EventConfig } from "@/lib/event-config";
import type { SutaConversationController } from "@/lib/suta/useSutaConversation";
import type { SutaEmotion } from "@/lib/suta/scene";
import { ConversationTranscript } from "./ConversationTranscript";
import { MicrophoneButton } from "./MicrophoneButton";
import { SutaIntroduction } from "./SutaIntroduction";
import { SutaOrb } from "./SutaOrb";
import { TextComposer } from "./TextComposer";
import { VoiceStatus } from "./VoiceStatus";
import { VoiceVisualizer } from "./VoiceVisualizer";

function emotionForState(state: SutaConversationController["state"]): SutaEmotion {
  switch (state) { case "LISTENING": case "INTERRUPTED": return "curious"; case "THINKING": case "SEARCHING": return "thinking"; case "ERROR": case "OFFLINE": return "alert"; default: return "warm"; }
}

export function SutaVoiceExperience({ controller, event }: { controller: SutaConversationController; event: EventConfig; }) {
  const { state, messages, isLive, scene, pillar, startListening, stopListening, sendText } = controller;
  const emotion = state === "SPEAKING" ? scene.emotion : emotionForState(state);
  const handleMicPress = () => { if (isLive || state === "LISTENING") { void stopListening(); return; } void startListening(); };
  const isBusy = !isLive && (state === "THINKING" || state === "SEARCHING" || state === "SPEAKING");
  const pillarLabel = pillar === "connecter" ? "CONNECTER" : pillar === "equiper" ? "EQUIPER" : pillar === "former" ? "FORMER" : pillar === "service-public" ? "SERVICE PUBLIC" : null;
  const hasConversation = messages.length > 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-8">
      <div className={`flex flex-col items-center gap-3 transition-all duration-500 ${hasConversation ? "scale-90" : "scale-100"}`}>
        {pillarLabel && <span className="rounded-full border border-ansut-blue/15 bg-white/80 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-ansut-blue shadow-sm">{pillarLabel}</span>}
        <SutaOrb state={state} emotion={emotion} />
        <VoiceStatus state={state} />
        <VoiceVisualizer state={state} />
      </div>
      {!hasConversation ? <SutaIntroduction event={event} onStarter={(prompt) => void sendText(prompt)} /> : <div className="w-full max-w-2xl"><ConversationTranscript messages={messages} /></div>}
      <div className="flex flex-col items-center gap-4">
        <MicrophoneButton state={state} onPress={handleMicPress} liveCallActive={isLive} />
        {!isLive && <TextComposer onSubmit={(text) => void sendText(text)} disabled={isBusy} />}
        {isLive && <p className="max-w-md text-center text-xs text-ansut-text-muted">Conversation en cours — parlez naturellement, vous pouvez interrompre SUTA a tout moment.</p>}
      </div>
    </div>
  );
}
