"use client";

import { useCallback, useRef } from "react";
import { RealtimeClient, type RealtimeClientCallbacks } from "./RealtimeClient";
import { shapeKnowledgeForModel } from "./knowledge-context";
import { SentenceStream } from "@/lib/voice/sentence-stream";
import { SpeechPlayer } from "@/lib/voice/SpeechPlayer";

export interface StartRealtimeCallbacks extends RealtimeClientCallbacks {
  /** `query` : la requête réelle envoyée à search-knowledge (le modèle y
   * reformule la question) — c'est elle qui pilote la sélection des preuves,
   * l'affichage doit juger sur la même base. */
  onToolResult?: (name: string, result: unknown, query?: string) => void;
}
export interface StartRealtimeResult { simulated: boolean; }

async function executeToolByName(name: string, argumentsJson: string): Promise<unknown> {
  if (name !== "search_knowledge") return { error: `Outil non pris en charge côté client : ${name}` };
  const args: unknown = JSON.parse(argumentsJson);
  const response = await fetch("/api/tools/search-knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return response.json();
}

/**
 * Mode azure-tts (lot 3) : le cerveau Realtime ne produit que du texte ; on
 * enveloppe les callbacks pour découper ce texte en phrases et les faire
 * prononcer par la bouche Azure (SpeechPlayer), sans toucher au cœur
 * RealtimeClient. Toute prise de parole de l'utilisateur coupe la lecture
 * locale — le pendant acoustique du response.cancel.
 */
function brancherBoucheAzure(callbacks: StartRealtimeCallbacks, player: SpeechPlayer): StartRealtimeCallbacks {
  let phrases = new SentenceStream();
  return {
    ...callbacks,
    onResponseCreated: () => { phrases = new SentenceStream(); callbacks.onResponseCreated?.(); },
    onAssistantTranscriptDelta: (delta) => {
      for (const phrase of phrases.push(delta)) player.enqueue(phrase);
      callbacks.onAssistantTranscriptDelta?.(delta);
    },
    onAssistantTranscriptDone: (transcript) => {
      const reste = phrases.flush();
      if (reste) player.enqueue(reste);
      callbacks.onAssistantTranscriptDone?.(transcript);
    },
    onSpeechStarted: () => { player.stop(); callbacks.onSpeechStarted?.(); },
  };
}

export function useRealtimeSession() {
  const clientRef = useRef<RealtimeClient | null>(null);
  const playerRef = useRef<SpeechPlayer | null>(null);
  const startingRef = useRef(false);

  const start = useCallback(async (callbacks: StartRealtimeCallbacks): Promise<StartRealtimeResult> => {
    if (startingRef.current) return { simulated: false };
    startingRef.current = true;
    clientRef.current?.disconnect(); clientRef.current = null;
    playerRef.current?.stop(); playerRef.current = null;
    try {
      const response = await fetch("/api/realtime/session", { method: "POST" });
      const session = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(session.error ?? "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
      if (!session.webrtcUrl) return { simulated: true };
      let effectiveCallbacks = callbacks;
      if (session.voiceEngine === "azure-tts") {
        const player = new SpeechPlayer({ onError: (message) => callbacks.onError?.(message) });
        playerRef.current = player;
        effectiveCallbacks = brancherBoucheAzure(callbacks, player);
      }
      const client = new RealtimeClient({
        clientSecret: session.clientSecret,
        webrtcUrl: session.webrtcUrl,
        executeTool: async (name, argumentsJson) => {
          const result = await executeToolByName(name, argumentsJson);
          // La requête de l'outil porte l'intention (le modèle y reformule la
          // question) : c'est elle qui pilote la sélection des preuves — et
          // l'affichage (carte, sources) doit juger sur la même base.
          let query = "";
          try {
            const parsed = JSON.parse(argumentsJson) as { query?: unknown };
            if (typeof parsed.query === "string") query = parsed.query;
          } catch { /* arguments illisibles : sélection sans intention */ }
          callbacks.onToolResult?.(name, result, query);
          return shapeKnowledgeForModel(result, query);
        },
        callbacks: effectiveCallbacks,
      });
      clientRef.current = client;
      await client.connect();
      return { simulated: false };
    } finally { startingRef.current = false; }
  }, []);

  const stop = useCallback(() => { playerRef.current?.stop(); playerRef.current = null; clientRef.current?.disconnect(); clientRef.current = null; }, []);
  const interrupt = useCallback(() => { playerRef.current?.stop(); clientRef.current?.interrupt(); }, []);
  const sendText = useCallback((text: string) => { playerRef.current?.stop(); clientRef.current?.sendUserText(text); }, []);
  const addContext = useCallback((text: string) => { clientRef.current?.addContext(text); }, []);
  const isActive = useCallback(() => clientRef.current !== null, []);

  return { start, stop, interrupt, sendText, addContext, isActive };
}
