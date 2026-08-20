"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
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
import { useRealtimeSession } from "@/lib/realtime/useRealtimeSession";

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
 * Écran principal SUTA (cahier des charges, section 22).
 *
 * Deux chemins selon le fournisseur Realtime réellement actif
 * (`session.webrtcUrl` renvoyé par `/api/realtime/session`) :
 * - Fournisseur réel (Azure) : connexion WebRTC live (micro, audio,
 *   transcription, interruption naturelle, appel d'outils) —
 *   `useRealtimeSession` / `RealtimeClient`. ⚠️ Non testable contre Azure
 *   depuis cet environnement de développement (accès réseau restreint),
 *   voir docs/architecture.md.
 * - `MockRealtimeProvider` (pas de `webrtcUrl`) : repli simulé, où le canal
 *   texte appelle réellement `search_knowledge` (Lot 4/5) pour rester
 *   honnête sur ce qui est démontrable sans Realtime.
 */
export default function Home() {
  const kiosk = useKioskMode();
  const [state, setState] = useState<ConversationState>("IDLE");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [isLive, setIsLive] = useState(false);
  const demoTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const expectedDisconnect = useRef(false);
  const currentUserMsgId = useRef<string | null>(null);
  const currentAssistantMsgId = useRef<string | null>(null);
  const pendingSources = useRef<TranscriptMessage["sources"]>(undefined);

  const { start, stop, isActive } = useRealtimeSession();

  const resetDemo = useCallback(() => {
    demoTimeouts.current.forEach(clearTimeout);
    demoTimeouts.current = [];
    if (isActive()) {
      expectedDisconnect.current = true;
      stop();
    }
    setIsLive(false);
    setState("IDLE");
    setMessages([]);
  }, [isActive, stop]);

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

  /** Ajoute un delta au message en cours (id mémorisé dans `idRef`), ou en crée un. */
  const appendDelta = useCallback(
    (role: TranscriptMessage["role"], idRef: RefObject<string | null>, delta: string) => {
      setMessages((prev) => {
        if (idRef.current) {
          return prev.map((m) => (m.id === idRef.current ? { ...m, text: m.text + delta } : m));
        }
        const id = `${role}-${Date.now()}`;
        idRef.current = id;
        return [...prev, { id, role, text: delta }];
      });
    },
    [],
  );

  /** Fixe le texte final du message en cours et le referme (nouveau tour ensuite). */
  const finalizeMessage = useCallback(
    (
      role: TranscriptMessage["role"],
      idRef: RefObject<string | null>,
      text: string,
      sources?: TranscriptMessage["sources"],
    ) => {
      setMessages((prev) => {
        if (idRef.current) {
          return prev.map((m) => (m.id === idRef.current ? { ...m, text, sources } : m));
        }
        return [...prev, { id: `${role}-${Date.now()}`, role, text, sources }];
      });
      idRef.current = null;
    },
    [],
  );

  const endLiveCall = useCallback(() => {
    expectedDisconnect.current = true;
    stop();
    setIsLive(false);
    setState("IDLE");
  }, [stop]);

  const startLiveOrSimulated = useCallback(async () => {
    setState("LISTENING");

    try {
      const result = await start({
        onConnectionStateChange: (connState) => {
          if (connState === "disconnected") {
            setIsLive(false);
            if (!expectedDisconnect.current) {
              setState("OFFLINE");
            }
            expectedDisconnect.current = false;
          }
        },
        onSpeechStarted: () => {
          currentUserMsgId.current = null;
          setState((prev) => (prev === "SPEAKING" ? "INTERRUPTED" : "LISTENING"));
        },
        onSpeechStopped: () => {
          setState("THINKING");
        },
        onUserTranscriptDelta: (delta) => appendDelta("user", currentUserMsgId, delta),
        onUserTranscriptDone: (transcript) =>
          finalizeMessage("user", currentUserMsgId, transcript),
        onAssistantTranscriptDelta: (delta) => {
          setState("SPEAKING");
          appendDelta("suta", currentAssistantMsgId, delta);
        },
        onAssistantTranscriptDone: (transcript) => {
          finalizeMessage("suta", currentAssistantMsgId, transcript, pendingSources.current);
          pendingSources.current = undefined;
        },
        onResponseDone: () => {
          setState((prev) => (prev === "ERROR" || prev === "OFFLINE" ? prev : "LISTENING"));
        },
        onToolResult: (name, result) => {
          if (
            name === "search_knowledge" &&
            result &&
            typeof result === "object" &&
            "results" in result
          ) {
            setState("SEARCHING");
            const results = (result as { results: SearchResult[] }).results;
            pendingSources.current = results.map((r) => ({ title: r.title, source: r.source }));
          }
        },
        onError: (message) => {
          setState("ERROR");
          setMessages((prev) => [...prev, { id: `s-${Date.now()}`, role: "suta", text: message }]);
          endLiveCall();
        },
      });

      if (result.simulated) {
        const listenTimeout = setTimeout(() => {
          runDemoTurn("Bonjour SUTA, qui es-tu ?");
        }, 1800);
        demoTimeouts.current.push(listenTimeout);
        return;
      }

      setIsLive(true);
    } catch (error) {
      setState("ERROR");
      setMessages((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: "suta",
          text: error instanceof Error ? error.message : TECHNICAL_ERROR_ANSWER,
        },
      ]);
      const t = setTimeout(() => setState("IDLE"), 3000);
      demoTimeouts.current.push(t);
    }
  }, [start, runDemoTurn, appendDelta, finalizeMessage, endLiveCall]);

  const handleMicPress = useCallback(() => {
    if (isLive) {
      endLiveCall();
      return;
    }
    if (state === "LISTENING") {
      setState("IDLE");
      return;
    }
    void startLiveOrSimulated();
  }, [isLive, state, endLiveCall, startLiveOrSimulated]);

  const isBusy = !isLive && (state === "THINKING" || state === "SEARCHING" || state === "SPEAKING");

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

        <MicButton state={state} onPress={handleMicPress} liveCallActive={isLive} />

        <TextComposer onSubmit={runDemoTurn} disabled={isBusy || isLive} />

        <ExampleQuestions
          questions={DEMO_QUESTIONS}
          onSelect={runDemoTurn}
          disabled={isBusy || isLive}
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
