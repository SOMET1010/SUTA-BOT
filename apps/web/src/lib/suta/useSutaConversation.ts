"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import type { ConversationState } from "@suta/shared";
import { getIdentityResponse } from "@/lib/identity-response";
import { useRealtimeSession } from "@/lib/realtime/useRealtimeSession";
import { experienceFromKnowledge, type SutaPillar } from "@/lib/suta/experience";
import { DEFAULT_SUTA_SCENE, type SutaScene } from "@/lib/suta/scene";
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
  const realtime = useRealtimeSession();

  const clearTimeouts = useCallback(() => { timeouts.current.forEach(clearTimeout); timeouts.current = []; }, []);
  const respond = useCallback((text: string, sources?: TranscriptSource[]) => {
    setState("SPEAKING");
    setMessages((prev) => [...prev, { id: `suta-${Date.now()}`, role: "suta", text, sources }]);
    const t = setTimeout(() => setState("IDLE"), 2500); timeouts.current.push(t);
  }, []);

  const applyExperience = useCallback((question: string, results: SearchResult[]) => {
    if (!results.length) return;
    const decision = experienceFromKnowledge(question, results);
    setPillar(decision.pillar);
    setScene(decision.scene);
  }, []);

  const runSimulatedTurn = useCallback(async (question: string) => {
    clearTimeouts(); latestQuestion.current = question;
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text: question }]);
    setState("THINKING");
    const identityAnswer = getIdentityResponse(question);
    if (identityAnswer) { const t = setTimeout(() => respond(identityAnswer), 500); timeouts.current.push(t); return; }
    const t = setTimeout(async () => {
      setState("SEARCHING");
      try {
        const response = await fetch("/api/tools/search-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: question }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) { respond(body.error ?? TECHNICAL_ERROR_ANSWER); return; }
        const results = body.results as SearchResult[];
        if (!results.length) { respond(NO_INFO_ANSWER); return; }
        const [top] = results;
        const answer = top.content.length > ANSWER_PREVIEW_MAX_CHARS ? `${top.content.slice(0, ANSWER_PREVIEW_MAX_CHARS).trim()}…` : top.content;
        applyExperience(question, results);
        respond(answer, results.map((r) => ({ title: r.title, source: r.source })));
      } catch { respond(TECHNICAL_ERROR_ANSWER); }
    }, 400); timeouts.current.push(t);
  }, [applyExperience, clearTimeouts, respond]);

  const appendDelta = useCallback((role: TranscriptMessage["role"], idRef: RefObject<string | null>, delta: string) => {
    setMessages((prev) => {
      if (idRef.current) return prev.map((m) => m.id === idRef.current ? { ...m, text: m.text + delta } : m);
      const id = `${role}-${Date.now()}`; idRef.current = id; return [...prev, { id, role, text: delta }];
    });
  }, []);

  const finalizeMessage = useCallback((role: TranscriptMessage["role"], idRef: RefObject<string | null>, text: string, sources?: TranscriptSource[]) => {
    if (role === "user") latestQuestion.current = text;
    setMessages((prev) => {
      if (idRef.current) return prev.map((m) => m.id === idRef.current ? { ...m, text, sources } : m);
      return [...prev, { id: `${role}-${Date.now()}`, role, text, sources }];
    }); idRef.current = null;
  }, []);

  const endLiveCall = useCallback(() => { expectedDisconnect.current = true; realtime.stop(); setIsLive(false); setState("IDLE"); }, [realtime]);

  const startListening = useCallback(async () => {
    if (isLive || state === "CONNECTING") return;
    sessionGeneration.current += 1; const generation = sessionGeneration.current; clearTimeouts(); setState("CONNECTING");
    try {
      const result = await realtime.start({
        onConnectionStateChange: (connState) => { if (connState === "disconnected") { setIsLive(false); if (!expectedDisconnect.current) setState("OFFLINE"); expectedDisconnect.current = false; } },
        onSpeechStarted: () => { currentUserMsgId.current = null; setState((prev) => prev === "SPEAKING" ? "INTERRUPTED" : "LISTENING"); },
        onSpeechStopped: () => setState("THINKING"),
        onUserTranscriptDelta: (delta) => appendDelta("user", currentUserMsgId, delta),
        onUserTranscriptDone: (transcript) => finalizeMessage("user", currentUserMsgId, transcript),
        onAssistantTranscriptDelta: (delta) => { setState("SPEAKING"); appendDelta("suta", currentAssistantMsgId, delta); },
        onAssistantTranscriptDone: (transcript) => { finalizeMessage("suta", currentAssistantMsgId, transcript, pendingSources.current); pendingSources.current = undefined; },
        onResponseDone: () => setState((prev) => prev === "ERROR" || prev === "OFFLINE" ? prev : "LISTENING"),
        onToolResult: (name, result) => {
          if (name === "search_knowledge" && result && typeof result === "object" && "results" in result) {
            setState("SEARCHING");
            const found = (result as { results: SearchResult[] }).results;
            pendingSources.current = found.map((r) => ({ title: r.title, source: r.source }));
            applyExperience(latestQuestion.current, found);
          }
        },
        onError: (message) => { setState("ERROR"); setScene({ emotion: "alert", visual: null }); setMessages((prev) => [...prev, { id: `suta-${Date.now()}`, role: "suta", text: message }]); endLiveCall(); },
      });
      if (result.simulated) { const t = setTimeout(() => runSimulatedTurn("Bonjour SUTA, qui es-tu ?"), 1800); timeouts.current.push(t); return; }
      if (generation !== sessionGeneration.current) { expectedDisconnect.current = true; realtime.stop(); return; }
      setIsLive(true); setState("LISTENING");
    } catch (error) {
      setState("ERROR"); setScene({ emotion: "alert", visual: null });
      setMessages((prev) => [...prev, { id: `suta-${Date.now()}`, role: "suta", text: error instanceof Error ? error.message : TECHNICAL_ERROR_ANSWER }]);
      const t = setTimeout(() => setState("IDLE"), 3000); timeouts.current.push(t);
    }
  }, [realtime, clearTimeouts, appendDelta, finalizeMessage, endLiveCall, runSimulatedTurn, applyExperience, isLive, state]);

  const stopListening = useCallback(async () => {
    if (isLive) { endLiveCall(); return; }
    if (state === "LISTENING" || state === "CONNECTING") { sessionGeneration.current += 1; expectedDisconnect.current = true; realtime.stop(); setState("IDLE"); }
  }, [isLive, state, endLiveCall, realtime]);
  const interrupt = useCallback(async () => { if (isLive) realtime.interrupt(); }, [isLive, realtime]);
  const sendText = useCallback(async (message: string) => {
    const trimmed = message.trim(); if (!trimmed) return; latestQuestion.current = trimmed;
    if (isLive) { setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text: trimmed }]); setState("THINKING"); realtime.sendText(trimmed); return; }
    await runSimulatedTurn(trimmed);
  }, [isLive, realtime, runSimulatedTurn]);
  const reset = useCallback(() => {
    clearTimeouts(); if (isLive) { expectedDisconnect.current = true; realtime.stop(); }
    setIsLive(false); setState("IDLE"); setMessages([]); setScene(DEFAULT_SUTA_SCENE); setPillar(null); latestQuestion.current = "";
  }, [clearTimeouts, isLive, realtime]);

  return { state, messages, isLive, scene, pillar, startListening, stopListening, interrupt, sendText, reset };
}
