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

/**
 * Réglage du barge-in par l'URL, pour tester en conditions réelles sans
 * rebuild :
 * - `?bargein=off` — diagnostic : pendant que SUTA parle, les
 *   `speech_started` sont journalisés mais n'annulent JAMAIS la réponse.
 *   Si la voix se coupe encore, la cause n'est pas le barge-in client.
 * - `?bargein=450` — délai de confirmation en millisecondes (borné
 *   100–2000) à la place des 280 ms par défaut.
 * Sans paramètre : comportement normal.
 */
export function bargeInConfigFromUrl(): { disabled: boolean; confirmMs?: number } {
  if (typeof window === "undefined") return { disabled: false };
  const raw = new URLSearchParams(window.location.search).get("bargein");
  if (!raw) return { disabled: false };
  if (raw === "off") return { disabled: true };
  const ms = Number(raw);
  if (Number.isFinite(ms) && ms >= 100 && ms <= 2000) return { disabled: false, confirmMs: ms };
  return { disabled: false };
}
