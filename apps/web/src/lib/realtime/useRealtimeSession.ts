"use client";

import { useCallback, useRef } from "react";
import { RealtimeClient, type RealtimeClientCallbacks } from "./RealtimeClient";

export interface StartRealtimeCallbacks extends RealtimeClientCallbacks {
  /** Appelé quand un outil a été exécuté, avec son résultat brut. */
  onToolResult?: (name: string, result: unknown) => void;
}

export interface StartRealtimeResult {
  /** false si une session réelle (WebRTC) a été établie, true si repli simulé. */
  simulated: boolean;
}

async function executeToolByName(name: string, argumentsJson: string): Promise<unknown> {
  if (name !== "search_knowledge") {
    return { error: `Outil non pris en charge côté client : ${name}` };
  }

  const args: unknown = JSON.parse(argumentsJson);
  const response = await fetch("/api/tools/search-knowledge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return response.json();
}

/**
 * Pont entre l'API `/api/realtime/session` (backend) et `RealtimeClient`
 * (WebRTC navigateur). Repli transparent : si le fournisseur actif est
 * `MockRealtimeProvider` (pas de `webrtcUrl`), l'appelant doit utiliser le
 * flux simulé existant (`runDemoTurn`) — cette fonction ne fait rien de
 * plus dans ce cas.
 */
export function useRealtimeSession() {
  const clientRef = useRef<RealtimeClient | null>(null);

  const start = useCallback(
    async (callbacks: StartRealtimeCallbacks): Promise<StartRealtimeResult> => {
      const response = await fetch("/api/realtime/session", { method: "POST" });
      const session = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(session.error ?? "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
      }

      if (!session.webrtcUrl) {
        return { simulated: true };
      }

      const client = new RealtimeClient({
        clientSecret: session.clientSecret,
        webrtcUrl: session.webrtcUrl,
        executeTool: async (name, argumentsJson) => {
          const result = await executeToolByName(name, argumentsJson);
          callbacks.onToolResult?.(name, result);
          return result;
        },
        callbacks,
      });

      clientRef.current = client;
      await client.connect();
      return { simulated: false };
    },
    [],
  );

  const stop = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  const interrupt = useCallback(() => {
    clientRef.current?.interrupt();
  }, []);

  const sendText = useCallback((text: string) => {
    clientRef.current?.sendUserText(text);
  }, []);

  const isActive = useCallback(() => clientRef.current !== null, []);

  return { start, stop, interrupt, sendText, isActive };
}
