export interface TranscriptMessage {
  id: string;
  role: "user" | "suta";
  text: string;
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
        </div>
      ))}
    </div>
  );
}
