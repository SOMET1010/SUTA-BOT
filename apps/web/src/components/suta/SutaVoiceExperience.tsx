"use client";

import type { EventConfig } from "@/lib/event-config";
import type { SutaConversationController } from "@/lib/suta/useSutaConversation";
import { ConversationTranscript } from "./ConversationTranscript";
import { MicrophoneButton } from "./MicrophoneButton";
import { SutaIntroduction } from "./SutaIntroduction";
import { SutaOrb } from "./SutaOrb";
import { TextComposer } from "./TextComposer";
import { VoiceStatus } from "./VoiceStatus";
import { VoiceVisualizer } from "./VoiceVisualizer";

/**
 * Composition centrale de l'expérience vocale SUTA : avatar, statut,
 * transcription et saisie. Ne parle jamais directement à Azure/OpenAI —
 * toute l'orchestration vient de `controller` (`useSutaConversation`),
 * conformément à la séparation moteur/UI (cahier des charges UI, section
 * 21).
 */
export function SutaVoiceExperience({
  controller,
  event,
}: {
  controller: SutaConversationController;
  event: EventConfig;
}) {
  const { state, messages, isLive, startListening, stopListening, sendText } = controller;

  const handleMicPress = () => {
    if (isLive || state === "LISTENING") {
      void stopListening();
      return;
    }
    void startListening();
  };

  const isBusy = !isLive && (state === "THINKING" || state === "SEARCHING" || state === "SPEAKING");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="flex flex-col items-center gap-3">
        <SutaOrb state={state} />
        <VoiceStatus state={state} />
        <VoiceVisualizer state={state} />
      </div>

      {messages.length === 0 ? (
        <SutaIntroduction event={event} />
      ) : (
        <ConversationTranscript messages={messages} />
      )}

      <div className="flex flex-col items-center gap-4">
        <MicrophoneButton state={state} onPress={handleMicPress} liveCallActive={isLive} />
        <TextComposer onSubmit={(text) => void sendText(text)} disabled={isBusy || isLive} />
      </div>
    </div>
  );
}
