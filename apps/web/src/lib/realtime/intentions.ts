/**
 * VAGUE 3 (analyse Diakité du 01/09, go Patrick du 02/09) — le routage
 * d'intention : comprendre CE QUE la question demande AVANT de chercher.
 *
 * Jusqu'ici, trois couches devinaient chacune dans leur coin : une liste de
 * questions interdites (hors domaine), un tri par recouvrement de mots-clés
 * (choix de la fiche de lieu), une chaîne de si/alors (enrichissement de la
 * requête). Le contre-audit du 01/09 a montré la limite : un « couperet
 * aveugle » qui coupe sur un chiffre sans jugement de pertinence.
 *
 * Ce module est désormais LE seul endroit où l'intention se décide. Il est
 * délibérément déterministe : pas de modèle dans la boucle, chaque décision
 * est reproductible et testable au banc, question par question. L'ordre de
 * détection est porteur de leçons de terrain (la formation se teste AVANT
 * l'équipement — cas Elvire du 02/09 : « qu'elle se forme à l'utilisation de
 * son smartphone » partait vers le PASS).
 */

export type Intention =
  | "hors_domaine" // météo, politique, sport… — hors du périmètre ANSUT
  | "formation" // se former, apprendre, littératie numérique
  | "operateurs" // présence des opérateurs mobiles (Moov, MTN, Orange)
  | "equipement" // s'équiper, PASS, smartphone subventionné
  | "couverture" // ma localité est-elle connectée, fibre, réseau, zone blanche
  | "projets" // ce que l'ANSUT prévoit : PTBA, PND, projets, programmes
  | "generale"; // tout le reste — le comportement d'avant, inchangé

function sansAccents(texte: string): string {
  return texte.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Marqueurs de questions manifestement étrangères au périmètre ANSUT.
 * Contre-audit du 01/09 : « quel temps fait-il à Abidjan ? » servait une
 * fiche BTS — un nom de ville suffisait à franchir le plancher. */
const MARQUEURS_HORS_DOMAINE =
  /quel temps fait|meteo\b|pleuvoir|president de la (republique|cote)|premier ministre|\belection\b|match de|football|coupe d.afrique|capitale d[eu]\b|recette de cuisine|quelle heure/;

/** Lexique du domaine : si la question en porte un, elle n'est JAMAIS
 * classée hors domaine, quel que soit le reste de la phrase (« y a-t-il du
 * réseau au stade pendant le match ? » est une vraie question ANSUT). */
const LEXIQUE_DOMAINE =
  /connect|internet|reseau|couverture|fibre|antenne|operateur|\bpass\b|smartphone|telephone|numerique|ansut|zone blanche|debit|\bsite/;

const MOTIF_FORMATION = /\bform|apprendre|competence|initier|alphabetis|litteratie/;
const MOTIF_OPERATEURS = /operateurs?\b|\borange\b|\bmtn\b|\bmoov\b|sites? mobiles?/;
const MOTIF_EQUIPEMENT = /equip|smartphone|ordinateur|tablette|telephone|\bpass\b/;
const MOTIF_COUVERTURE = /connect|internet|reseau|couverture|fibre|zone blanche|antenne|debit/;
const MOTIF_PROJETS = /\bptba\b|\bpnd\b|projets?\b|prevoit|programmes?\b|strategie/;

/**
 * L'intention d'une question citoyenne. L'ordre des tests EST la
 * hiérarchie des leçons de terrain :
 * 1. hors domaine d'abord (mais jamais si le lexique du domaine est là) ;
 * 2. formation AVANT équipement (cas Elvire — « se former au smartphone ») ;
 * 3. opérateurs AVANT couverture (contre-audit — « quels opérateurs
 *    couvrent Korhogo ? » contient « couvrent » mais demande les opérateurs) ;
 * 4. couverture avant projets (« mon village est-il connecté » prime).
 */
export function detecterIntention(question: string): Intention {
  const q = sansAccents(question);
  if (MARQUEURS_HORS_DOMAINE.test(q) && !LEXIQUE_DOMAINE.test(q)) return "hors_domaine";
  if (MOTIF_FORMATION.test(q)) return "formation";
  if (MOTIF_OPERATEURS.test(q)) return "operateurs";
  if (MOTIF_EQUIPEMENT.test(q)) return "equipement";
  if (MOTIF_COUVERTURE.test(q)) return "couverture";
  if (MOTIF_PROJETS.test(q)) return "projets";
  return "generale";
}

/** Famille de fiche de LIEU qui répond à chaque intention : quand plusieurs
 * fiches d'une même localité sont candidates (Localité, Opérateurs mobiles,
 * BTS…), c'est l'intention qui départage — plus aucun biais fixe, dans un
 * sens comme dans l'autre (contre-audit : « un biais a été troqué contre le
 * biais inverse »). */
const FAMILLE_LIEU_PAR_INTENTION: Partial<Record<Intention, RegExp>> = {
  operateurs: /^op[ée]rateurs mobiles — /i,
  couverture: /^localit[ée] — /i,
};

/** Le titre de fiche de lieu que cette intention appelle en premier, ou
 * `null` quand l'intention n'a pas de préférence (le recouvrement de mots
 * pleins départage alors, comme avant). */
export function familleDeLieuPreferee(intention: Intention): RegExp | null {
  return FAMILLE_LIEU_PAR_INTENTION[intention] ?? null;
}
