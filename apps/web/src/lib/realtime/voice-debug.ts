/**
 * Journal TEMPORAIRE de la chaîne voix/interruption — à retirer une fois le
 * comportement validé en conditions réelles (demande explicite : instrumenter
 * speech_started / durée avant speech_stopped / décision du BargeInGate /
 * response.cancel / response.done pour diagnostiquer les coupures).
 *
 * `console.info` : VISIBLE par défaut dans la console (y compris l'inspection
 * distante du mobile) — le niveau debug était masqué et le diagnostic de
 * terrain le manquait. Aucun contenu de conversation n'est journalisé —
 * uniquement les événements.
 */
export function vlog(event: string, details?: Record<string, unknown>): void {
  if (typeof console === "undefined") return;
  console.info(`[suta:voix] ${event}`, details ?? "");
}

export type BargeInMode = "normal" | "off" | "half";

/**
 * Réglage du barge-in par l'URL, pour tester en conditions réelles sans
 * rebuild :
 * - `?bargein=off` — diagnostic : pendant que SUTA parle, les
 *   `speech_started` sont journalisés mais n'annulent JAMAIS la réponse.
 *   Si la voix se coupe encore, la cause n'est pas le barge-in client.
 * - `?bargein=half` — half-duplex (repris de l'expérimentation
 *   voice-stability-half-duplex) : le MICRO est coupé pendant que SUTA
 *   parle, donc même l'écho du haut-parleur ne pollue ni le VAD ni la
 *   transcription. Aucune interruption possible — mode kiosque de secours,
 *   jamais le défaut.
 * - `?bargein=450` — délai de confirmation en millisecondes (borné
 *   100–2000) à la place des 280 ms par défaut.
 * Sans paramètre : comportement normal (interruption sur parole soutenue).
 */
export function bargeInConfigFromUrl(): { mode: BargeInMode; confirmMs?: number } {
  if (typeof window === "undefined") return { mode: "normal" };
  const raw = new URLSearchParams(window.location.search).get("bargein");
  if (!raw) return { mode: "normal" };
  if (raw === "off") return { mode: "off" };
  if (raw === "half") return { mode: "half" };
  const ms = Number(raw);
  if (Number.isFinite(ms) && ms >= 100 && ms <= 2000) return { mode: "normal", confirmMs: ms };
  return { mode: "normal" };
}
