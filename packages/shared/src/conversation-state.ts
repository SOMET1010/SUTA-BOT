/**
 * États de la machine à états de l'interface vocale SUTA.
 * Voir cahier des charges, section 12.
 */
export const CONVERSATION_STATES = [
  "IDLE",
  // Établissement de la session vocale (clé éphémère, puis WebRTC). Sans cet
  // état, l'interface affichait « Je vous écoute » dès le clic, alors que
  // rien n'était encore connecté : la première question était perdue et
  // l'utilisateur devait la répéter.
  "CONNECTING",
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
  CONNECTING: "Connexion en cours...",
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
