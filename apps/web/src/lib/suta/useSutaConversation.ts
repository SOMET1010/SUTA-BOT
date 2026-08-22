"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ConversationState } from "@suta/shared";
import { getIdentityResponse } from "@/lib/identity-response";
import { useRealtimeSession } from "@/lib/realtime/useRealtimeSession";
import { experienceFromKnowledge, type SutaPillar } from "@/lib/suta/experience";
import { DEFAULT_SUTA_SCENE, type SutaScene } from "@/lib/suta/scene";
import { EMPTY_SUTA_CONTEXT, contextForModel, updateSessionContext, type SutaSessionContext } from "@/lib/suta/sessionContext";
import type { VisualPoint } from "@/lib/suta/visuals";

const NO_INFO_ANSWER = "Je n'ai pas encore suffisamment d'informations fiables dans ma base pour répondre à cette question.";
const TECHNICAL_ERROR_ANSWER = "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.";
const ANSWER_PREVIEW_MAX_CHARS = 400;

export interface TranscriptSource { title: string; source: string; }
export interface TranscriptMessage { id: string; role: "user" | "suta"; text: string; sources?: TranscriptSource[]; }
interface SearchResult { title: string; content: string; source: string; score: number; location?: VisualPoint; }

export interface SutaConversationController {
  state: ConversationState;
  messages: TranscriptMessage[];
  isLive: boolean;
  scene: SutaScene;
  pillar: SutaPillar | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  interrupt: () => Promise<void>;
  sendText: (message: string) => Promise<void>;
  reset: () => void;
}

export function useSutaConversation(): SutaConversationController {
  const [state, setState] = useState<ConversationState>("IDLE");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [scene, setScene] = useState<SutaScene>(DEFAULT_SUTA_SCENE);
  const [pillar, setPillar] = useState<SutaPillar | null>(null);

  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const expectedDisconnect = useRef(false);
  const sessionGeneration = useRef(0);
  const currentUserMsgId = useRef<string | null>(null);
  const currentAssistantMsgId = useRef<string | null>(null);
  const pendingSources = useRef<TranscriptSource[] | undefined>(undefined);
  const latestQuestion = useRef("");
  const sessionContext = useRef<SutaSessionContext>({ ...EMPTY_SUTA_CONTEXT, lastTopics: [] });
  const searchAbort = useRef<AbortController | null>(null);
  const resumeVoiceAfterNetwork = useRef(false);
  const realtime = useRealtimeSession();

  const clearTimeouts = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
  }, []);

  const remember = useCallback((utterance: string) => {
    const before = contextForModel(sessionContext.current);
    const next = updateSessionContext(sessionContext.current, utterance);
    const after = contextForModel(next);
    sessionContext.current = next;
    if (after && after !== before && realtime.isActive()) realtime.addContext(after);
  }, [realtime]);

  const respond = useCallback((text: string, sources?: TranscriptSource[]) => {
    setState("SPEAKING");
    setMessages((prev) => [...prev, { id: `suta-${Date.now()}`, role: "suta", text, sources }]);
    const timer = setTimeout(() => setState("IDLE"), 2500);
    timeouts.current.push(timer);
  }, []);

  const applyExperience = useCallback((question: string, results: SearchResult[]) => {
    if (!results.length) return;
    const decision = experienceFromKnowledge(question, results);
    setPillar(decision.pillar);
    setScene(decision.scene);
  }, []);

  const contextualQuestion = useCallback((question: string) => `${question}${contextForModel(sessionContext.current)}`, []);

  const runSimulatedTurn = useCallback(async (question: string) => {
    const generation = sessionGeneration.current;
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setState("SEARCHING");
    try {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: contextualQuestion(question) }),
        signal: controller.signal,
      });
      if (generation !== sessionGeneration.current) return;
      if (!response.ok) {
        setState("ERROR");
        return;
      }
      const data = await response.json() as { results?: SearchResult[] };
      const results = data.results ?? [];
      applyExperience(question, results);
      if (!results.length) {
        respond(NO_INFO_ANSWER);
        return;
      }
      const answer = results[0]?.content?.trim() || NO_INFO_ANSWER;
      respond(answer.slice(0, ANSWER_PREVIEW_MAX_CHARS), results.slice(0, 4).map((r) => ({ title: r.title, source: r.source })));
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      if (generation !== sessionGeneration.current) return;
      setState(typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ERROR");
    } finally {
      if (searchAbort.current === controller) searchAbort.current = null;
    }
  }, [applyExperience, contextualQuestion, respond]);

  const startListening = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("OFFLINE");
      return;
    }
    const generation = sessionGeneration.current;
    expectedDisconnect.current = false;
    setState("CONNECTING");
    try {
      await realtime.start({
        onConnectionStateChange: (connected) => {
          if (generation !== sessionGeneration.current) return;
          if (connected) {
            setIsLive(true);
            setState("LISTENING");
          } else if (!expectedDisconnect.current) {
            setIsLive(false);
            setState(typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ERROR");
          }
        },
        onUserTranscriptDelta: () => {},
        onUserTranscriptDone: (text) => {
          if (generation !== sessionGeneration.current || !text.trim()) return;
          latestQuestion.current = text.trim();
          remember(text);
          const id = `user-${Date.now()}`;
          currentUserMsgId.current = id;
          setMessages((prev) => [...prev, { id, role: "user", text: text.trim() }]);
          setState("THINKING");
        },
        onAssistantTranscriptDelta: (delta) => {
          if (generation !== sessionGeneration.current) return;
          setState("SPEAKING");
          setMessages((prev) => {
            const id = currentAssistantMsgId.current;
            if (!id) {
              const nextId = `suta-${Date.now()}`;
              currentAssistantMsgId.current = nextId;
              return [...prev, { id: nextId, role: "suta", text: delta }];
            }
            return prev.map((m) => m.id === id ? { ...m, text: `${m.text}${delta}` } : m);
          });
        },
        onAssistantTranscriptDone: (text) => {
          if (generation !== sessionGeneration.current) return;
          const id = currentAssistantMsgId.current;
          if (id) {
            setMessages((prev) => prev.map((m) => m.id === id ? { ...m, text: text || m.text, sources: pendingSources.current } : m));
          }
          currentAssistantMsgId.current = null;
          pendingSources.current = undefined;
          setState("LISTENING");
        },
        onSpeechStarted: async () => {
          if (generation !== sessionGeneration.current) return;
          if (state === "SPEAKING") await realtime.interrupt();
          setState("LISTENING");
        },
        onError: () => {
          if (generation !== sessionGeneration.current) return;
          setIsLive(false);
          setState(typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ERROR");
        },
        onToolCall: async (name, args) => {
          if (generation !== sessionGeneration.current) return { error: "session-expired" };
          if (name !== "search_knowledge") return { error: `unknown-tool:${name}` };
          const question = typeof args?.query === "string" ? args.query : latestQuestion.current;
          try {
            const response = await fetch("/api/knowledge/search", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ query: contextualQuestion(question) }),
            });
            if (!response.ok) return { error: "knowledge-search-failed" };
            const data = await response.json() as { results?: SearchResult[] };
            const results = data.results ?? [];
            applyExperience(question, results);
            pendingSources.current = results.slice(0, 4).map((r) => ({ title: r.title, source: r.source }));
            return { results: results.map((r) => ({ content: r.content })) };
          } catch {
            return { error: "knowledge-search-failed" };
          }
        },
      });
      if (generation !== sessionGeneration.current) {
        await realtime.stop();
        return;
      }
      const context = contextForModel(sessionContext.current);
      if (context) realtime.addContext(context);
    } catch {
      if (generation !== sessionGeneration.current) return;
      setIsLive(false);
      setState(typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ERROR");
    }
  }, [applyExperience, contextualQuestion, realtime, remember, state]);

  const stopListening = useCallback(async () => {
    resumeVoiceAfterNetwork.current = false;
    expectedDisconnect.current = true;
    await realtime.stop();
    setIsLive(false);
    setState("IDLE");
  }, [realtime]);

  const interrupt = useCallback(async () => {
    await realtime.interrupt();
    setState("LISTENING");
  }, [realtime]);

  const sendText = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) return;
    clearTimeouts();
    remember(text);
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text }]);

    const identity = getIdentityResponse(text);
    if (identity) {
      respond(identity);
      return;
    }

    if (realtime.isActive()) {
      latestQuestion.current = text;
      setState("THINKING");
      await realtime.sendText(text);
      return;
    }

    await runSimulatedTurn(text);
  }, [clearTimeouts, realtime, remember, respond, runSimulatedTurn]);

  const reset = useCallback(() => {
    sessionGeneration.current += 1;
    clearTimeouts();
    searchAbort.current?.abort();
    searchAbort.current = null;
    resumeVoiceAfterNetwork.current = false;
    expectedDisconnect.current = true;
    void realtime.stop();
    sessionContext.current = { ...EMPTY_SUTA_CONTEXT, lastTopics: [] };
    currentUserMsgId.current = null;
    currentAssistantMsgId.current = null;
    pendingSources.current = undefined;
    latestQuestion.current = "";
    setMessages([]);
    setIsLive(false);
    setPillar(null);
    setScene(DEFAULT_SUTA_SCENE);
    setState("IDLE");
  }, [clearTimeouts, realtime]);

  useEffect(() => {
    const handleOffline = () => {
      searchAbort.current?.abort();
      resumeVoiceAfterNetwork.current = isLive || realtime.isActive();
      if (resumeVoiceAfterNetwork.current) {
        expectedDisconnect.current = true;
        void realtime.stop();
      }
      setIsLive(false);
      setState("OFFLINE");
    };
    const handleOnline = () => {
      if (!resumeVoiceAfterNetwork.current) return;
      resumeVoiceAfterNetwork.current = false;
      void startListening();
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [isLive, realtime, startListening]);

  return { state, messages, isLive, scene, pillar, startListening, stopListening, interrupt, sendText, reset };
}
