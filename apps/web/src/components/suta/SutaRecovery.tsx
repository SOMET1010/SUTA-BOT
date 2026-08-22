"use client";

import type { ConversationState } from "@suta/shared";

export function SutaRecovery({ state, onRetry, onReset }: { state: ConversationState; onRetry: () => void; onReset: () => void }) {
  if (state !== "ERROR" && state !== "OFFLINE") return null;
  const offline = state === "OFFLINE";
  return <div role="alert" className="mx-auto mt-2 flex max-w-xl flex-col items-center gap-3 rounded-[24px] border border-ansut-orange/25 bg-white/[0.07] p-5 text-center backdrop-blur-sm">
    <div><p className="font-semibold text-white">{offline ? "La conversation vocale a été interrompue." : "SUTA a rencontré une difficulté."}</p><p className="mt-1 text-sm text-white/60">{offline ? "Votre écran reste disponible. Vous pouvez reconnecter la voix sans perdre le fil visible de la conversation." : "Vous pouvez réessayer immédiatement ou recommencer une nouvelle conversation."}</p></div>
    <div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={onRetry} className="rounded-full bg-ansut-orange px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5">Reconnecter la voix</button><button type="button" onClick={onReset} className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white/85 transition hover:bg-white/10">Nouvelle conversation</button></div>
  </div>;
}
