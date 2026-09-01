/**
 * Questions à réponse réservée sur le chemin texte (recette v3 du 31/08).
 *
 * Deux familles que la recherche documentaire ne doit JAMAIS servir :
 *
 * - C10 : les statuts de sélection (« quels villages ont été retenus ? »,
 *   « ZIRIGLO a-t-il été retenu ? »). En voix, le prompt impose la réponse
 *   officielle ; au clavier, la question filait en recherche et restituait
 *   agrégats et zones blanches au lieu d'un refus. La même règle vaut ici,
 *   de façon déterministe, AVANT toute recherche.
 *
 * - C14 : les demandes de démarche (« prends un rendez-vous »,
 *   « inscris-moi »). SUTA informe, il n'agit pas — mais la question
 *   partait en recherche et « prends un rendez-vous » recevait une fiche
 *   sur le conseil d'administration. On dit clairement ce qu'il ne fait
 *   pas, et ce qu'il peut faire à la place.
 */

function normaliser(question: string): string {
  return question
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const SELECTION_PATTERNS = [
  /\bretenue?s?\b/,
  /\bselectionn/,
  /\bscoring\b|\bscore aigf\b/,
  /\bvague de financement\b/,
  /\bpriorisation\b/,
  /\b(villages?|localites?) (choisis?|choisies?|gagnants?)\b/,
];

const SELECTION_ANSWER =
  "Je ne peux pas confirmer ni commenter la sélection des localités : les localités concernées seront annoncées officiellement par l'ANSUT. Ce que je peux faire tout de suite, c'est vous dire ce qui existe aujourd'hui dans votre localité — donnez-moi son nom.";

export function getSelectionResponse(question: string): string | null {
  const normalisee = normaliser(question);
  return SELECTION_PATTERNS.some((pattern) => pattern.test(normalisee)) ? SELECTION_ANSWER : null;
}

/**
 * Contre-recette v4 (R12/A-02) : la demande de scores ou de documents
 * internes ne divulguait rien (le filtre serveur tient), mais répondait par
 * un article sans rapport au lieu d'un refus clair. L'intention est
 * désormais reconnue et refusée explicitement, avant toute recherche.
 */
const ADMIN_PATTERNS = [
  /\bdocuments? (internes?|admin|confidentiels?)\b/,
  /\bdonnees (internes|confidentielles)\b/,
  /\b(montre|donne|partage|envoie|liste)[a-z]*[ -](moi|nous)? ?(les|tes|vos)? ?(documents?|fichiers?|rapports?|scores?)\b/,
  /\bscores? (aigf|de priorisation|des? (villages?|localites?))\b/,
  /\baudit interne\b|\brapport d audit\b/,
  /\bdecisions? internes?\b/,
];

const ADMIN_ANSWER =
  "Les documents de travail, les scores et les décisions internes de l'ANSUT ne sont pas accessibles ici : je ne partage que l'information publique. Ce que je peux vous donner : les faits publics sur votre localité, les programmes et les démarches — dites-moi ce qui vous serait utile.";

export function getAdminResponse(question: string): string | null {
  const normalisee = normaliser(question);
  return ADMIN_PATTERNS.some((pattern) => pattern.test(normalisee)) ? ADMIN_ANSWER : null;
}

const ACTION_PATTERNS = [
  /\brendez vous\b/,
  /\binscri(s|vez)[ ]?(moi|nous|le|la)\b/,
  /\b(m|nous|s) inscrire\b/,
  /\bdepose(r|z)? (un |une |ma |mon )?(dossier|plainte|reclamation|demande)\b/,
  /\breclamation\b/,
];

const ACTION_ANSWER =
  "Je ne peux pas faire cette démarche à votre place : je suis un assistant d'information, je n'ai pas accès aux inscriptions ni aux rendez-vous. L'équipe de l'ANSUT présente sur le stand peut vous accompagner pour la démarche elle-même. En attendant, je peux vous expliquer les conditions et les étapes — dites-moi ce qui vous intéresse.";

export function getActionResponse(question: string): string | null {
  const normalisee = normaliser(question);
  return ACTION_PATTERNS.some((pattern) => pattern.test(normalisee)) ? ACTION_ANSWER : null;
}
