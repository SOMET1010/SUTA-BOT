/**
 * Réponse d'identité de SUTA (cahier des charges, section 4, Démonstration 1).
 * Ce type de question relève de la personnalité de l'agent, pas de la base
 * de connaissances : une fois un vrai modèle connecté (Lot 3), c'est le
 * prompt système (`packages/ai/src/prompts/suta-system.ts`) qui portera ce
 * comportement plutôt qu'un appel à `search_knowledge`. Cette fonction
 * reproduit ce choix de façon déterministe en attendant.
 */

const IDENTITY_PATTERNS = [/qui es-tu/i, /qui êtes-vous/i, /^bonjour(\s+suta)?\s*[.!]?$/i];

const IDENTITY_ANSWER =
  "Bonjour. Je suis SUTA, l'assistant intelligent d'ANSUT CONNECTE. Je peux vous aider à découvrir les services, programmes et informations de l'ANSUT. Que souhaitez-vous savoir ?";

export function getIdentityResponse(question: string): string | null {
  const trimmed = question.trim();
  return IDENTITY_PATTERNS.some((pattern) => pattern.test(trimmed)) ? IDENTITY_ANSWER : null;
}
