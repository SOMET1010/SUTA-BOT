/**
 * Demande d'un conseiller humain (recette DTDI du 31/08, constat A-02 :
 * « je veux parler à un conseiller humain » recevait un article sur les
 * usages de l'IA dans l'administration).
 *
 * Sur le chemin texte sans modèle, cette intention est reconnue de façon
 * déterministe AVANT toute recherche documentaire ; en session vocale,
 * c'est le prompt système qui porte le même comportement.
 *
 * La réponse n'invente RIEN : pas de numéro, pas d'horaires, pas de
 * formulaire tant que l'ANSUT n'a pas fourni son canal officiel — elle
 * oriente vers les personnes réellement présentes (l'équipe du stand, en
 * contexte salon) et propose de continuer à aider en attendant.
 */

function normaliser(question: string): string {
  return question
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const ESCALADE_PATTERNS = [
  // « je veux parler à un conseiller (humain) », « puis-je joindre un agent ? »,
  // « je voudrais discuter avec quelqu'un / une personne / un responsable »
  /\b(parler|discuter|echanger|joindre|contacter) .*\b(conseiller|conseillere|agent|humain|responsable|quelqu un|une personne|une vraie personne)\b/,
  /\bconseillere? humaine?\b/,
  /\bservice client\b/,
  /\bun humain\b/,
];

const ESCALADE_ANSWER =
  "Je vous comprends : parfois rien ne remplace une personne. Je suis un assistant numérique — pour échanger avec quelqu'un de l'ANSUT, adressez-vous à l'équipe présente sur le stand, elle pourra vous accompagner directement. En attendant, dites-moi ce que vous cherchez et je regarde déjà avec vous.";

export function getEscaladeResponse(question: string): string | null {
  const normalisee = normaliser(question);
  return ESCALADE_PATTERNS.some((pattern) => pattern.test(normalisee)) ? ESCALADE_ANSWER : null;
}
