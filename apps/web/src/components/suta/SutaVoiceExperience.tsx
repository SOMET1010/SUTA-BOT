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
  switch (state) {
    case "LISTENING":
    case "INTERRUPTED":
      return "curious";
    case "THINKING":
    case "SEARCHING":
      return "thinking";
    case "SPEAKING":
      return "explaining";
    case "ERROR":
    case "OFFLINE":
      return "alert";
    default:
      return "warm";
  }
}

/**
 * Composition centrale de l'experience vocale SUTA. La machine de conversation
 * reste independante de l'UI ; ici nous traduisons simplement son etat en une
 * premiere intention emotionnelle. Une scene pourra ensuite surcharger cette
 * emotion (bonne nouvelle, alerte, reassurance...) selon le contenu.
 */
export function SutaVoiceExperience({
  controller,
  event,
}: {
  controller: SutaConversationController;
  event: EventConfig;
}) {
  const { state, messages, isLive, startListening, stopListening, sendText } = controller;
  const emotion = emotionForState(state);

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
        <SutaOrb state={state} emotion={emotion} />
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
