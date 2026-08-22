"use client";

import type { ConversationState } from "@suta/shared";

export function SutaRecovery({ state, onRetry, onReset }: { state: ConversationState; onRetry: () => void; onReset: () => void }) {
  if (state !== "ERROR" && state !== "OFFLINE") return null;
  const offline = state === "OFFLINE";
  return <div role="alert" className="mx-auto mt-4 flex max-w-xl flex-col items-center gap-3 rounded-[24px] border border-ansut-orange/20 bg-white/90 p-5 text-center shadow-sm backdrop-blur">
    <div><p className="font-semibold text-ansut-blue">{offline ? "La conversation vocale a été interrompue." : "SUTA a rencontré une difficulté."}</p><p className="mt-1 text-sm text-ansut-text-muted">{offline ? "Votre écran reste disponible. Vous pouvez reconnecter la voix sans perdre le fil visible de la conversation." : "Vous pouvez réessayer immédiatement ou recommencer une nouvelle conversation."}</p></div>
    <div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={onRetry} className="rounded-full bg-ansut-blue px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5">Reconnecter la voix</button><button type="button" onClick={onReset} className="rounded-full border border-ansut-border bg-white px-5 py-2 text-sm font-semibold text-ansut-blue">Nouvelle conversation</button></div>
  </div>;
}
