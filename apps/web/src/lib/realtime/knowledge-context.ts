/**
 * Sélection et mise en forme des résultats `search_knowledge` avant leur
 * retour au modèle vocal (function_call_output).
 *
 * Deux constats de salon successifs :
 * 1. En recevant les fiches brutes, le modèle les récitait — d'où la
 *    consigne de synthèse (« preuves », une à trois phrases).
 * 2. La synthèse courte peut porter sur la MAUVAISE preuve : pour « mon
 *    village est-il connecté ? », le classement peut faire remonter une
 *    fiche méthodologique (« 434 localités sans coordonnées GPS ») ou la
 *    fiche d'un village que la personne n'a jamais nommé. L'étage de
 *    sélection ci-dessous filtre par pertinence à l'intention AVANT
 *    l'injection : une fiche de localité précise n'est une preuve que si
 *    la question nomme cette localité ; une fiche méthodologique, de
 *    doctrine ou d'agrégat n'en est une que si la question porte là-dessus.
 *    S'il ne reste rien, on le dit au modèle plutôt que de lui tendre un
 *    texte voisin.
 *
 * Module pur (aucune dépendance React) pour rester testable unitairement.
 */

/** Au-delà de trois fiches, le modèle inventorie au lieu de synthétiser. */
const MAX_PREUVES = 3;
/** Audit du 23/08 : une question hors périmètre (« qui a gagné le match ? »)
 * remonte des fiches à ~0,23 de score — du bruit vectoriel. En dessous de ce
 * plancher, un résultat n'est pas une preuve. */
const SCORE_PLANCHER = 0.3;

export const CONSIGNE_SYNTHESE =
  "Ces textes sont des preuves, pas une réponse : ne les récite jamais. " +
  "Réponds uniquement à la question posée, en une à trois phrases orales " +
  "simples, avec les seuls faits qui y répondent — tais tout le reste, même " +
  "exact. Puis propose d'en dire plus si c'est utile. Jamais de document, " +
  "de fiche, de source ni de coordonnées.";

/** Ajouté à la consigne quand les preuves portent au moins un chiffre.
 * Runs vocaux n°4 et 5 (V-CONCRET) : deux fois de suite, le modèle a cité
 * « ANSUT Academy » — un exemple nommé — en taisant les chiffres présents
 * dans deux preuves sur trois. La règle générale du prompt ne suffisait
 * pas ; la consigne devient explicite au moment précis où c'est vrai. */
export const CONSIGNE_CHIFFRE =
  " Ces preuves portent des chiffres : ta réponse en cite au moins un — " +
  "un exemple nommé ne suffit pas. Choisis un chiffre qui parle au citoyen " +
  "(une cible, un prix, un délai) plutôt qu'un budget administratif.";

/** Chiffres en chiffres, ou en toutes lettres (les fiches écrivent aussi
 * « vingt-quatre mois »). */
const PORTE_UN_CHIFFRE =
  /\d|\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze|quinze|vingt|trente|quarante|cinquante|soixante|cents?|mille|millions?|milliards?)\b/i;

export const CONSIGNE_INSUFFISANTE =
  "La recherche n'a rien trouvé qui réponde directement à cette question. " +
  "Dis-le simplement et honnêtement, sans donner un autre fait en guise de " +
  "réponse. Si un nom de localité te manque, demande-le ; sinon propose une " +
  "autre façon d'aider.";

/**
 * Questions qui portent réellement sur la méthode, les données, un décompte
 * ou une définition : pour elles, les fiches de doctrine et d'agrégat SONT
 * la bonne réponse et ne doivent pas être écartées.
 */
const QUESTION_GENERALE =
  /\bcombien\b|\bcomment\b|\bpourquoi\b|m[ée]thod|donn[ée]es|\bsources?\b|d[ée]finition|c'est quoi|qu'est[- ]ce|glossaire|coordonn[ée]es|national|c[ôo]te d'ivoire|\bpays\b/i;

/**
 * Fiches méthodologiques, de doctrine ou d'agrégat : jamais une réponse à
 * une question citoyenne concrète (« mon village est-il connecté ? »).
 * Calibré sur le corpus réel (familles doctrine-* et zp-*).
 */
const TITRE_HORS_QUESTION_CITOYENNE =
  /m[ée]thodolog|m[ée]thode|glossaire|typologie|indicateurs|d[ée]finition|sources de donn[ée]es|d[ée]comptes|coup d'[œo]eil|param[èe]tres|ne conna[îi]t pas la position|r[ée]partition des r[ôo]les|comment (on passe|l'ansut|sont identifi)|combien de localit[ée]s|d'o[uù] vient|ce qu'est/i;

const CONTENU_HORS_QUESTION_CITOYENNE =
  /coordonn[ée]es g[ée]ographiques exploitables|ne peut pas [êe]tre calcul[ée]e|compt(er|[ée]es) comme non couvertes par pr[ée]caution/i;

/**
 * Niveaux stratégiques que le corpus ne couvre pas (audit du 23/08 : le PTBA
 * n'a aucune fiche, et des voisins vectoriels à ~0,45 passaient le plancher —
 * le modèle risquait de broder au lieu d'avouer). Quand la question demande
 * explicitement un tel niveau et qu'AUCUNE preuve retenue n'en parle, on rend
 * zéro preuve : SUTA dit qu'elle n'a pas encore cette information.
 * Auto-guérissant : le jour où des fiches PTBA sont ingérées, leurs
 * titres/contenus matcheront le motif et passeront normalement.
 */
const NIVEAUX_STRATEGIQUES = [
  { nom: "PTBA", motif: /\bptba\b|plan de travail et budget annuel/i },
  // Un rapport d'audit interne est ADMIN par nature : aucune fiche publique
  // n'en parlera jamais — la question doit toujours aboutir à zéro preuve,
  // plutôt qu'à des rapports d'activités voisins résumés comme un audit.
  { nom: "AUDIT_INTERNE", motif: /audit interne|rapport d'audit/i },
];

/** Mots d'un nom de site sans valeur d'identification. */
const JETONS_GENERIQUES = new Set([
  "bts", "site", "poste", "fibre", "padci", "abri", "ecole", "centre",
  "nord", "sud", "est", "ouest", "ville", "village", "localite",
  "departement", "region", "district", "autonome",
  "zone", "blanche", "grise", "noire",
]);

/** Même normalisation que la voie géographique : minuscules, sans accents,
 * traits d'union devenus espaces. */
function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{M}/gu, "").replace(/-/g, " ").toLowerCase();
}

function jetonsSignificatifs(texte: string): string[] {
  return normaliser(texte)
    .split(/[^\p{L}0-9]+/u)
    .filter((jeton) => jeton.length >= 3 && !JETONS_GENERIQUES.has(jeton));
}

/**
 * Une fiche « de lieu précis » : village, site ou département nommé. Elle ne
 * répond à la question que si la question nomme ce lieu — sinon c'est la
 * fiche d'un AUTRE village, pire qu'une absence de réponse.
 */
function estFicheDeLieu(titre: string): boolean {
  if (/^(localit[ée]|bts|fibre|poste|site|abri|[ée]cole|centre|zone blanche) — /i.test(titre)) return true;
  if (/d[ée]partement de /i.test(titre)) return true;
  // Fiches de couverture « NOM DE LOCALITÉ (RÉGION) » : nom tout en capitales
  // suivi d'une parenthèse.
  const avantParenthese = titre.split("(")[0].trim();
  return titre.includes("(") && avantParenthese.length > 0 && avantParenthese === avantParenthese.toUpperCase();
}

function lieuNommeDansLaQuestion(titre: string, questionNormalisee: string): boolean {
  const jetons = jetonsSignificatifs(titre);
  // Sans jeton identifiable, impossible de juger : on laisse passer.
  if (jetons.length === 0) return true;
  return jetons.some((jeton) => questionNormalisee.includes(jeton));
}

interface ResultatBrut {
  title?: unknown;
  content?: unknown;
  score?: unknown;
}

interface Preuve {
  titre: string;
  contenu: string;
  score: number;
}

function candidats(result: unknown): Preuve[] | null {
  if (
    !result || typeof result !== "object" || !("results" in result) ||
    !Array.isArray((result as { results: unknown[] }).results)
  ) {
    return null;
  }
  return (result as { results: ResultatBrut[] }).results
    .map((r) => ({
      titre: typeof r.title === "string" ? r.title : "",
      contenu: typeof r.content === "string" ? r.content : "",
      // Sans score exploitable, on ne pénalise pas : plancher inapplicable.
      score: typeof r.score === "number" ? r.score : 1,
    }))
    .filter((p) => p.contenu.length > 0);
}

/** Exporté pour les tests : la liste des contenus retenus comme preuves. */
export function selectionnerPreuves(question: string, result: unknown): string[] | null {
  const tous = candidats(result);
  if (tous === null) return null;

  const questionNormalisee = normaliser(question);
  const questionGenerale = QUESTION_GENERALE.test(question);

  const retenues = tous.filter((p) => {
    if (p.score < SCORE_PLANCHER) return false;
    if (!questionGenerale && (
      TITRE_HORS_QUESTION_CITOYENNE.test(p.titre) ||
      CONTENU_HORS_QUESTION_CITOYENNE.test(p.contenu)
    )) {
      return false;
    }
    if (estFicheDeLieu(p.titre) && !lieuNommeDansLaQuestion(p.titre, questionNormalisee)) {
      return false;
    }
    return true;
  });

  // Niveau stratégique explicitement demandé mais absent du corpus : mieux
  // vaut zéro preuve qu'un texte voisin tendu comme réponse de substitution.
  for (const niveau of NIVEAUX_STRATEGIQUES) {
    if (niveau.motif.test(question) && !retenues.some((p) => niveau.motif.test(p.titre) || niveau.motif.test(p.contenu))) {
      return [];
    }
  }

  // Diversité : retour de terrain du 23/08 — « où me former à Korhogo ? »
  // recevait trois fiches d'infrastructure de Korhogo et jamais les fiches de
  // sujet (le plan), coupées par le plafond. Quand des fiches de sujet
  // existent, une seule fiche du lieu suffit à ancrer la réponse ; le sujet
  // remplit le reste.
  const lieux = retenues.filter((p) => estFicheDeLieu(p.titre));
  const sujets = retenues.filter((p) => !estFicheDeLieu(p.titre));
  const preuves = sujets.length > 0 ? [...lieux.slice(0, 1), ...sujets] : lieux;
  return preuves.slice(0, MAX_PREUVES).map((p) => p.contenu);
}

/**
 * Rend la charge utile envoyée au modèle. Toute forme inattendue est rendue
 * telle quelle : une erreur d'outil (`{ error }`) doit parvenir au modèle
 * pour qu'il dise honnêtement qu'il n'a pas trouvé.
 */
export function shapeKnowledgeForModel(result: unknown, question = ""): unknown {
  const preuves = selectionnerPreuves(question, result);
  if (preuves === null) return result;
  if (preuves.length === 0) return { preuves: [], consigne: CONSIGNE_INSUFFISANTE };
  const consigne = preuves.some((p) => PORTE_UN_CHIFFRE.test(p))
    ? CONSIGNE_SYNTHESE + CONSIGNE_CHIFFRE
    : CONSIGNE_SYNTHESE;
  return { preuves, consigne };
}

/** Les premières phrases COMPLÈTES d'un texte, sans jamais couper un mot. */
export function premieresPhrases(texte: string, maxPhrases: number, maxChars: number): string {
  const phrases = texte.trim().split(/(?<=[.!?])\s+/).slice(0, maxPhrases);
  let sortie = "";
  for (const phrase of phrases) {
    if (sortie.length > 0 && (sortie + " " + phrase).length > maxChars) break;
    sortie = sortie.length > 0 ? `${sortie} ${phrase}` : phrase;
  }
  // Première phrase déjà trop longue : repli à la frontière de mot.
  if (sortie.length > maxChars) {
    const fenetre = sortie.slice(0, maxChars);
    const dernierEspace = fenetre.lastIndexOf(" ");
    sortie = `${fenetre.slice(0, dernierEspace > 40 ? dernierEspace : maxChars).trimEnd()}…`;
  }
  return sortie;
}

/**
 * Réponse du chemin texte dégradé (aucun modèle conversationnel sur ce
 * chemin). Constat d'écran du 23/08 : la bulle récitait la fiche brute,
 * coupée en plein mot (« univ… ») — un moteur documentaire, pas un
 * assistant. On compose désormais : mêmes preuves que la voix (sélection
 * par intention), deux phrases complètes de la meilleure, puis l'offre
 * d'approfondir. Les fiches étant écrites en langage citoyen, leurs
 * premières phrases se lisent comme une réponse.
 */
export function composerReponseTexte(question: string, result: unknown): string {
  const preuves = selectionnerPreuves(question, result);
  if (preuves === null || preuves.length === 0) {
    return "Je n'ai pas encore d'information fiable pour répondre précisément à cette question. Précisez votre localité ou reformulez, et je regarde avec vous.";
  }
  const essentiel = premieresPhrases(preuves[0], 2, 320);
  return `${essentiel} Je peux vous en dire plus si vous voulez.`;
}
