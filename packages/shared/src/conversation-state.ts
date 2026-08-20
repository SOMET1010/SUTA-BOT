/**
 * États de la machine à états de l'interface vocale SUTA.
 * Voir cahier des charges, section 12.
 */
export const CONVERSATION_STATES = [
  "IDLE",
  "LISTENING",
  "THINKING",
  "SEARCHING",
  "SPEAKING",
  "INTERRUPTED",
  "ERROR",
  "OFFLINE",
] as const;

export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const CONVERSATION_STATE_LABELS: Record<ConversationState, string> = {
  IDLE: "SUTA est prêt",
  LISTENING: "Je vous écoute...",
  THINKING: "Je réfléchis...",
  SEARCHING: "Je recherche l'information...",
  SPEAKING: "SUTA répond",
  INTERRUPTED: "Un instant...",
  ERROR: "Une difficulté technique est survenue.",
  OFFLINE: "SUTA est actuellement hors ligne.",
};

export function isConversationState(value: string): value is ConversationState {
  return (CONVERSATION_STATES as readonly string[]).includes(value);
}
