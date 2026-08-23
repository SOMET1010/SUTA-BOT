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

  return tous
    .filter((p) => {
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
    })
    .slice(0, MAX_PREUVES)
    .map((p) => p.contenu);
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
  return { preuves, consigne: CONSIGNE_SYNTHESE };
}
