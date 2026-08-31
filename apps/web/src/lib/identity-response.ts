/**
 * Réponse d'identité de SUTA (cahier des charges, section 4, Démonstration 1).
 * Ce type de question relève de la personnalité de l'agent, pas de la base
 * de connaissances : en session vocale, c'est le prompt système
 * (`packages/ai/src/prompts/suta-system.ts`) qui porte ce comportement ;
 * cette fonction le reproduit de façon déterministe sur le chemin texte
 * sans modèle.
 *
 * Terrain du 31/08 (tests de l'équipe DTDI) : « QUI EST TU ? » — la
 * transcription vocale écrit sans trait d'union et conjugue de travers —
 * passait à côté des anciens motifs (/qui es-tu/), filait en recherche,
 * ne trouvait rien et recevait le repli « je n'ai pas d'information
 * fiable ». Un agent qui ne sait pas dire qui il est. On normalise donc
 * la question (minuscules, sans accents ni ponctuation) et on tolère les
 * variantes réellement entendues.
 */

/** Minuscules, sans accents, ponctuation et traits d'union devenus espaces. */
function normaliser(question: string): string {
  return question
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const IDENTITY_PATTERNS = [
  // « qui es-tu », « qui es tu », « qui est tu » (transcription), « qui êtes-vous »
  /\bqui (es|est|etes) (tu|vous)\b/,
  // « tu es qui ? », « t'es qui ? », « vous êtes qui ? », « c'est qui ? » —
  // anchorés : « c'est qui le directeur ? » ne doit PAS devenir une question
  // d'identité de SUTA.
  /^(tu es qui|t es qui|vous etes qui|c est qui)$/,
  /\bqui est suta\b/,
  /\b(c est quoi|qu est ce que) suta\b/,
  /\bsuta c est quoi\b/,
  /\bpresente (toi|vous)\b/,
  /\bpresentez vous\b/,
  /^bonjour( suta)?$/,
];

const IDENTITY_ANSWER =
  "Bonjour. Je suis SUTA, l'assistant intelligent d'ANSUT CONNECTE. Je peux vous aider à découvrir les services, programmes et informations de l'ANSUT. Que souhaitez-vous savoir ?";

export function getIdentityResponse(question: string): string | null {
  const normalisee = normaliser(question);
  return IDENTITY_PATTERNS.some((pattern) => pattern.test(normalisee)) ? IDENTITY_ANSWER : null;
}
