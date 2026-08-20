"use client";

import { useState } from "react";
import type { TranscriptMessage } from "@/lib/suta/useSutaConversation";

/**
 * Transcription — style "sous-titres" (dernier échange en évidence, pas un
 * historique de chat façon ChatGPT empilé à l'écran, conformément à la
 * consigne UI). L'historique complet reste disponible via un panneau
 * repliable, pour la traçabilité (cahier des charges, section 38).
 */
export function ConversationTranscript({ messages }: { messages: TranscriptMessage[] }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  if (messages.length === 0) return null;

  const last = messages[messages.length - 1];
  const previous = messages.slice(0, -1);
  const lastUserQuestion = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-3">
      {last.role === "suta" && lastUserQuestion && lastUserQuestion.id !== last.id && (
        <p className="text-xs uppercase tracking-wide text-ansut-text-muted">
          Vous avez demandé : « {lastUserQuestion.text} »
        </p>
      )}

      <p
        className={`w-full rounded-2xl border border-ansut-border bg-ansut-surface px-5 py-4 text-center text-base leading-relaxed sm:text-lg ${
          last.role === "user" ? "text-ansut-blue" : "text-ansut-blue"
        }`}
        aria-live="polite"
      >
        {last.text || "…"}
      </p>

      {previous.length > 0 && (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            className="mx-auto block text-xs text-ansut-text-muted underline-offset-2 hover:text-ansut-blue hover:underline"
          >
            {historyOpen
              ? "Masquer l'historique"
              : `Voir l'historique (${previous.length} message${previous.length > 1 ? "s" : ""})`}
          </button>

          {historyOpen && (
            <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto rounded-xl border border-ansut-border bg-ansut-background p-3 text-left text-sm">
              {previous.map((message) => (
                <li key={message.id} className="text-ansut-text-muted">
                  <span className="font-medium text-ansut-blue">
                    {message.role === "user" ? "Vous" : "SUTA"} :
                  </span>{" "}
                  {message.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
