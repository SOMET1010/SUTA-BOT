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
import { getIdentityResponse } from "@/lib/identity-response";
import { useIdleReset } from "@/lib/use-idle-reset";
import { useKioskMode } from "@/lib/use-kiosk-mode";

const NO_INFO_ANSWER =
  "Je n'ai pas encore suffisamment d'informations fiables dans ma base pour répondre à cette question.";
const TECHNICAL_ERROR_ANSWER =
  "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.";
const ANSWER_PREVIEW_MAX_CHARS = 400;

interface SearchResult {
  title: string;
  content: string;
  source: string;
  score: number;
}

/**
 * Écran principal SUTA (cahier des charges, section 22). Le canal texte
 * appelle réellement l'outil `search_knowledge` (Lot 4/5) — seule la
 * question d'identité (section 4, Démonstration 1) reste une réponse
 * scriptée, à la manière du prompt système une fois un modèle connecté.
 * La voix (WebRTC, interruption temps réel) reste simulée en attendant le
 * Lot 3 (connexion Realtime Azure/OpenAI réelle).
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

  const respond = useCallback((text: string, sources?: TranscriptMessage["sources"]) => {
    setState("SPEAKING");
    setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: "suta", text, sources }]);
    const idleTimeout = setTimeout(() => setState("IDLE"), 2500);
    demoTimeouts.current.push(idleTimeout);
  }, []);

  const runDemoTurn = useCallback(
    async (question: string) => {
      demoTimeouts.current.forEach(clearTimeout);
      demoTimeouts.current = [];

      setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: question }]);
      setState("THINKING");

      const identityAnswer = getIdentityResponse(question);
      if (identityAnswer) {
        const t = setTimeout(() => respond(identityAnswer), 500);
        demoTimeouts.current.push(t);
        return;
      }

      const searchTimeout = setTimeout(async () => {
        setState("SEARCHING");
        try {
          const response = await fetch("/api/tools/search-knowledge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: question }),
          });
          const body = await response.json().catch(() => ({}));

          if (!response.ok) {
            respond(body.error ?? TECHNICAL_ERROR_ANSWER);
            return;
          }

          const results = body.results as SearchResult[];
          if (results.length === 0) {
            respond(NO_INFO_ANSWER);
            return;
          }

          const [top] = results;
          const answer =
            top.content.length > ANSWER_PREVIEW_MAX_CHARS
              ? `${top.content.slice(0, ANSWER_PREVIEW_MAX_CHARS).trim()}…`
              : top.content;
          respond(
            answer,
            results.map((result) => ({ title: result.title, source: result.source })),
          );
        } catch {
          respond(TECHNICAL_ERROR_ANSWER);
        }
      }, 400);

      demoTimeouts.current.push(searchTimeout);
    },
    [respond],
  );

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
          Réponses issues de la base de connaissances de démonstration
          (voir data/demo/ — contenu fictif, non validé par l&apos;ANSUT).
        </footer>
      )}

      {kiosk && (
        <button
          type="button"
          onClick={resetDemo}
          aria-label="Réinitialiser la démonstration"
          className="fixed bottom-3 right-3 rounded-full bg-white/5 px-3 py-1.5 text-[10px] text-brand-text/25 transition-colors hover:bg-white/10 hover:text-brand-text/60"
        >
          Réinitialiser
        </button>
      )}
    </div>
  );
}
