"use client";

import { useState } from "react";

export interface TranscriptSource {
  title: string;
  source: string;
}

export interface TranscriptMessage {
  id: string;
  role: "user" | "suta";
  text: string;
  sources?: TranscriptSource[];
}

export function ConversationTranscript({
  messages,
}: {
  messages: TranscriptMessage[];
}) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div
      className="flex w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-2xl bg-black/20 p-4 sm:p-6"
      aria-live="polite"
      aria-label="Transcription de la conversation"
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex flex-col gap-1 ${
            message.role === "user" ? "items-end text-right" : "items-start text-left"
          }`}
        >
          <span className="text-xs uppercase tracking-wide text-brand-text/50">
            {message.role === "user" ? "Vous" : "SUTA"}
          </span>
          <p
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
              message.role === "user"
                ? "bg-brand-secondary text-brand-background"
                : "bg-white/10 text-brand-text"
            }`}
          >
            {message.text}
          </p>
          {message.sources && message.sources.length > 0 && (
            <SourcesDisclosure sources={message.sources} />
          )}
        </div>
      ))}
    </div>
  );
}

/** « Voir les sources » (cahier des charges, section 38). */
function SourcesDisclosure({ sources }: { sources: TranscriptSource[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-[85%]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs text-brand-secondary/80 underline-offset-2 hover:underline"
      >
        {open ? "Masquer les sources" : `Voir les sources (${sources.length})`}
      </button>
      {open && (
        <ul className="mt-1 flex flex-col gap-0.5 text-xs text-brand-text/50">
          {sources.map((source, index) => (
            <li key={index}>• {source.title}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
