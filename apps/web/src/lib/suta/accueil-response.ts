/**
 * Accueil déterministe du chemin texte (revue d'architecture du 03/09).
 *
 * Mesuré sur les huit boutons de l'écran d'accueil : six mènent quelque part
 * (invite à donner le nom du village, PASS, littératie, startups), mais
 * « Expliquez-moi simplement ce qui peut être utile dans ma situation ? » et
 * « Aide-moi à comprendre ce que les services publics peuvent faire pour
 * moi » recevaient des fiches prospectives à ~0,37-0,51 — de la prose, pas
 * une orientation. La voix sait accueillir (le prompt vocal l'impose :
 * « c'est TOI qui conduis la conversation ») ; le chemin texte ne savait
 * pas. Une demande large d'orientation ne part plus en recherche : elle
 * reçoit l'accueil qui dit ce que SUTA sait faire et par quoi commencer.
 *
 * Module pur, motifs volontairement étroits : une question précise
 * (« mon village est-il connecté ? ») ne doit jamais tomber ici.
 */

const ACCUEIL_MOTIFS: RegExp[] = [
  /aide[- ]moi a comprendre/,
  /(peut|peuvent|pouvez|peux) (faire|apporter)[^.?]{0,30}pour moi/,
  /utile[^.?]{0,20}(dans|a) ma situation/,
  /ma situation \?/,
  /par ou (je )?commence/,
  /que (peux|sais)[- ]tu faire/,
  /a quoi (tu sers|sers[- ]tu|servez[- ]vous)/,
];

export const REPONSE_ACCUEIL =
  "Je suis SUTA, l'assistant d'ANSUT CONNECTE. Concrètement, je peux : " +
  "vérifier si votre localité est couverte par le réseau — donnez-moi simplement son nom ; " +
  "vous dire comment vous équiper à petit prix avec le programme PASS ; " +
  "vous orienter vers les formations gratuites au numérique ; " +
  "et si le réseau manque chez vous, transmettre votre signalement à l'ANSUT. " +
  "Par quoi voulez-vous commencer ?";

export function getAccueilResponse(texte: string): string | null {
  const t = texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return ACCUEIL_MOTIFS.some((m) => m.test(t)) ? REPONSE_ACCUEIL : null;
}
