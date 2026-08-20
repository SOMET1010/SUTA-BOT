import { SUTA_SYSTEM_PROMPT } from "./suta-system";

/**
 * Charge le prompt système SUTA versionné (`suta-system.ts`). Réservé à un
 * usage côté serveur (Node.js) : les API routes qui créent une session
 * Realtime doivent injecter ce texte comme instructions.
 */
export function loadSutaSystemPrompt(): string {
  return SUTA_SYSTEM_PROMPT;
}
