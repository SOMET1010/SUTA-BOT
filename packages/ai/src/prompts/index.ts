import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

/**
 * Charge le prompt système SUTA versionné (`suta-system.md`). Réservé à un
 * usage côté serveur (Node.js) : les API routes qui créent une session
 * Realtime doivent injecter ce texte comme instructions.
 */
export function loadSutaSystemPrompt(): string {
  return readFileSync(join(currentDir, "suta-system.md"), "utf-8");
}
