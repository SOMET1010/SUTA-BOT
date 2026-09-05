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

/**
 * Terrain du 04/09 (test DSIS) : SUTA se présente comme « l'assistant
 * d'ANSUT CONNECTE » mais ne savait pas expliquer ce que c'est, ni dire
 * qui dirige l'ANSUT. Deux questions de personnalité/institution, pas de
 * base de connaissances : mêmes réponses déterministes que l'identité.
 * Le nom du DG vient de la documentation interne ANSUT (Matinales COM).
 */
const ANSUT_CONNECTE_PATTERNS = [
  /\b(c est quoi|qu est ce que|que veut dire|ca veut dire quoi) ansut connecte\b/,
  /\bansut connecte (c est quoi|ca veut dire quoi|qu est ce que c est)\b/,
  /\bexplique[sz]? (moi )?ansut connecte\b/,
];

const ANSUT_CONNECTE_ANSWER =
  "ANSUT CONNECTE est le dispositif de l'ANSUT qui rapproche le numérique des citoyens : vérifier la couverture réseau de votre localité, vous équiper à petit prix avec le programme PASS, vous orienter vers les formations gratuites au numérique, et transmettre vos signalements quand le réseau manque. Je suis SUTA, son assistant. Que puis-je faire pour vous ?";

const DG_PATTERNS = [
  /\bqui est le (directeur|directrice) (general|generale)( de l ansut)?\b/,
  /\bqui est le dg( de l ansut)?\b/,
  /\bqui dirige l ansut\b/,
  /\bc est qui le (directeur|dg)( general)?( de l ansut)?\b/,
  /\b(directeur general|dg) de l ansut c est qui\b/,
  /\b(nom|identite) du (directeur general|dg)( de l ansut)?\b/,
];

const DG_ANSWER =
  "Le Directeur général de l'ANSUT est monsieur Gilles Thierry Beugré. Que puis-je faire d'autre pour vous ?";

export function getIdentityResponse(question: string): string | null {
  const normalisee = normaliser(question);
  if (IDENTITY_PATTERNS.some((pattern) => pattern.test(normalisee))) return IDENTITY_ANSWER;
  if (ANSUT_CONNECTE_PATTERNS.some((pattern) => pattern.test(normalisee))) return ANSUT_CONNECTE_ANSWER;
  if (DG_PATTERNS.some((pattern) => pattern.test(normalisee))) return DG_ANSWER;
  return null;
}
