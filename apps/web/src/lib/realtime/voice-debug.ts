/**
 * Journal TEMPORAIRE de la chaîne voix/interruption — à retirer une fois le
 * comportement validé en conditions réelles (demande explicite : instrumenter
 * speech_started / speech_stopped / response.cancel / response.done et les
 * bascules LISTENING/SPEAKING pour diagnostiquer les coupures intempestives).
 *
 * `console.debug` : invisible par défaut, visible en réglant le niveau
 * « Verbose » des DevTools (ou l'inspection distante du mobile). Aucun
 * contenu de conversation n'est journalisé — uniquement les événements.
 */
export function vlog(event: string, details?: Record<string, unknown>): void {
  if (typeof console === "undefined") return;
  console.debug(`[suta:voix] ${event}`, details ?? "");
}
