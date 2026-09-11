import { COCKPIT_SYSTEM_PROMPT } from "./cockpit-system";
import { SUTA_SYSTEM_PROMPT } from "./suta-system";

/**
 * Charge le prompt système SUTA versionné (`suta-system.ts`). Réservé à un
 * usage côté serveur (Node.js) : les API routes qui créent une session
 * Realtime doivent injecter ce texte comme instructions.
 */
export function loadSutaSystemPrompt(): string {
  return SUTA_SYSTEM_PROMPT;
}

/** Prompt de l'instance SUTA Cockpit (assistant du DG) — jamais servi par
 * l'instance citoyenne : le choix se fait par SUTA_MODE au niveau du
 * déploiement, zéro pont entre les deux. */
export function loadCockpitSystemPrompt(): string {
  return COCKPIT_SYSTEM_PROMPT;
}
