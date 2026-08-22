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

/** Réduit un résultat de recherche à ce que le modèle doit savoir : les
 * contenus, sans titres ni sources ni scores. Les fiches sont écrites pour
 * se comprendre seules ; le reste est de l'appareil documentaire qui
 * déteint sur le ton. */
function shapeForModel(result: unknown): unknown {
  if (
    result &&
    typeof result === "object" &&
    "results" in result &&
    Array.isArray((result as { results: unknown[] }).results)
  ) {
    const contenus = (result as { results: { content?: unknown }[] }).results
      .map((r) => (typeof r.content === "string" ? r.content : null))
      .filter((c): c is string => c !== null);
    return {
      connaissances: contenus,
      consigne:
        "Réponds en conversation orale, naturelle et brève, à partir de ces connaissances. " +
        "Ne mentionne jamais de document, de fiche ni de source : tu sais, tu ne consultes pas.",
    };
  }
  return result;
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
  /** Vrai pendant qu'une session s'établit. Sans ce verrou, un second appui
   * sur le micro pendant la connexion ouvrait une DEUXIÈME session sans
   * fermer la première : deux flux audio, deux voix superposées — le
   * symptôme constaté au premier test en ligne. */
  const startingRef = useRef(false);

  const start = useCallback(
    async (callbacks: StartRealtimeCallbacks): Promise<StartRealtimeResult> => {
      if (startingRef.current) {
        return { simulated: false };
      }
      startingRef.current = true;

      // Une session encore vivante (relance après erreur, appui répété) se
      // ferme AVANT d'en ouvrir une autre : il ne doit jamais en exister deux.
      clientRef.current?.disconnect();
      clientRef.current = null;

      try {
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
          // L'interface reçoit le résultat complet (titres, sources, carte).
          callbacks.onToolResult?.(name, result);
          // Le modèle, lui, ne reçoit que la matière : lui montrer des champs
          // « title » et « source » l'invitait à parler de documents — le
          // ton documentaliste reproché au premier test. Ce qu'il lit ici
          // doit ressembler à sa propre mémoire, pas à une pile de fiches.
          return shapeForModel(result);
        },
        callbacks,
      });

      clientRef.current = client;
      await client.connect();
      return { simulated: false };
      } finally {
        startingRef.current = false;
      }
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
