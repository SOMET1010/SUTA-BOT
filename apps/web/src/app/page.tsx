"use client";

import { useCallback, useRef, useState } from "react";
import { DEMO_QUESTIONS, type ConversationState } from "@suta/shared";
import { BrandHeader } from "@/components/BrandHeader";
import {
  ConversationTranscript,
  type TranscriptMessage,
} from "@/components/ConversationTranscript";
import { ExampleQuestions } from "@/components/ExampleQuestions";
import { MicButton } from "@/components/MicButton";
import { StateIndicator } from "@/components/StateIndicator";
import { SutaOrb } from "@/components/SutaOrb";
import { TextComposer } from "@/components/TextComposer";
import { getDemoResponse } from "@/lib/demo-responses";
import { useIdleReset } from "@/lib/use-idle-reset";
import { useKioskMode } from "@/lib/use-kiosk-mode";

/**
 * Écran principal SUTA (Lot 1 — squelette d'interface, cahier des charges
 * section 22). Aucune connexion Realtime réelle n'est établie ici : les
 * transitions d'état sont simulées localement pour démontrer la machine à
 * états et la mise en page. Le branchement à un `RealtimeProvider` réel
 * (voix, interruption, `searchKnowledge`) arrive aux lots 2 à 5.
 */
export default function Home() {
  const kiosk = useKioskMode();
  const [state, setState] = useState<ConversationState>("IDLE");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const demoTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const resetDemo = useCallback(() => {
    demoTimeouts.current.forEach(clearTimeout);
    demoTimeouts.current = [];
    setState("IDLE");
    setMessages([]);
  }, []);

  useIdleReset(kiosk, resetDemo);

  const runDemoTurn = useCallback((question: string) => {
    demoTimeouts.current.forEach(clearTimeout);
    demoTimeouts.current = [];

    const userMessage: TranscriptMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: question,
    };
    setMessages((prev) => [...prev, userMessage]);
    setState("THINKING");

    const searchTimeout = setTimeout(() => setState("SEARCHING"), 500);
    const answerTimeout = setTimeout(() => {
      setState("SPEAKING");
      setMessages((prev) => [
        ...prev,
        { id: `s-${Date.now()}`, role: "suta", text: getDemoResponse(question) },
      ]);
      const idleTimeout = setTimeout(() => setState("IDLE"), 2200);
      demoTimeouts.current.push(idleTimeout);
    }, 1300);

    demoTimeouts.current.push(searchTimeout, answerTimeout);
  }, []);

  const handleMicPress = useCallback(() => {
    if (state === "LISTENING") {
      setState("IDLE");
      return;
    }
    setState("LISTENING");
    const listenTimeout = setTimeout(() => {
      runDemoTurn("Bonjour SUTA, qui es-tu ?");
    }, 1800);
    demoTimeouts.current.push(listenTimeout);
  }, [state, runDemoTurn]);

  const isBusy = state === "THINKING" || state === "SEARCHING" || state === "SPEAKING";

  return (
    <div className="flex flex-1 flex-col bg-brand-background">
      <BrandHeader kiosk={kiosk} />

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-12 text-center">
        <div className="flex flex-col items-center gap-2">
          <SutaOrb state={state} />
          <h1 className="text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">
            SUTA
          </h1>
          <p className="max-w-md text-brand-text/70">Comment puis-je vous aider ?</p>
          <StateIndicator state={state} />
        </div>

        <ConversationTranscript messages={messages} />

        <MicButton state={state} onPress={handleMicPress} />

        <TextComposer onSubmit={runDemoTurn} disabled={isBusy} />

        <ExampleQuestions
          questions={DEMO_QUESTIONS}
          onSelect={runDemoTurn}
          disabled={isBusy}
        />
      </main>

      {!kiosk && (
        <footer className="px-6 pb-6 text-center text-xs text-brand-text/30">
          Démonstration locale — aucune donnée n&apos;est envoyée à un service
          externe à ce stade (Lot 1).
        </footer>
      )}
    </div>
  );
}
