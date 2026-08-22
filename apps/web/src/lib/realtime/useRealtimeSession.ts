"use client";

import { useCallback, useRef } from "react";
import { RealtimeClient, type RealtimeClientCallbacks } from "./RealtimeClient";
import { shapeKnowledgeForModel } from "./knowledge-context";

export interface StartRealtimeCallbacks extends RealtimeClientCallbacks {
  onToolResult?: (name: string, result: unknown) => void;
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

export function useRealtimeSession() {
  const clientRef = useRef<RealtimeClient | null>(null);
  const startingRef = useRef(false);

  const start = useCallback(async (callbacks: StartRealtimeCallbacks): Promise<StartRealtimeResult> => {
    if (startingRef.current) return { simulated: false };
    startingRef.current = true;
    clientRef.current?.disconnect(); clientRef.current = null;
    try {
      const response = await fetch("/api/realtime/session", { method: "POST" });
      const session = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(session.error ?? "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
      if (!session.webrtcUrl) return { simulated: true };
      const client = new RealtimeClient({
        clientSecret: session.clientSecret,
        webrtcUrl: session.webrtcUrl,
        executeTool: async (name, argumentsJson) => {
          const result = await executeToolByName(name, argumentsJson);
          callbacks.onToolResult?.(name, result);
          return shapeKnowledgeForModel(result);
        },
        callbacks,
      });
      clientRef.current = client;
      await client.connect();
      return { simulated: false };
    } finally { startingRef.current = false; }
  }, []);

  const stop = useCallback(() => { clientRef.current?.disconnect(); clientRef.current = null; }, []);
  const interrupt = useCallback(() => { clientRef.current?.interrupt(); }, []);
  const sendText = useCallback((text: string) => { clientRef.current?.sendUserText(text); }, []);
  const addContext = useCallback((text: string) => { clientRef.current?.addContext(text); }, []);
  const isActive = useCallback(() => clientRef.current !== null, []);

  return { start, stop, interrupt, sendText, addContext, isActive };
}
