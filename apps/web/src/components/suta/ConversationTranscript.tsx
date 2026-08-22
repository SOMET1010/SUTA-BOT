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
        <p className="text-xs uppercase tracking-wide text-white/45">
          Vous avez demandé : « {lastUserQuestion.text} »
        </p>
      )}

      <p
        className="w-full rounded-2xl border border-white/10 bg-white/[0.07] px-5 py-4 text-center text-base leading-relaxed text-white/95 backdrop-blur-sm sm:text-lg"
        aria-live="polite"
      >
        {last.text || "…"}
      </p>

      {previous.length > 0 && (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setHistoryOpen((prev) => !prev)}
            className="mx-auto block text-xs text-white/45 underline-offset-2 hover:text-white/80 hover:underline"
          >
            {historyOpen
              ? "Masquer l'historique"
              : `Voir l'historique (${previous.length} message${previous.length > 1 ? "s" : ""})`}
          </button>

          {historyOpen && (
            <ul className="mt-2 flex max-h-48 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left text-sm">
              {previous.map((message) => (
                <li key={message.id} className="text-white/55">
                  <span className="font-medium text-white/85">
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
