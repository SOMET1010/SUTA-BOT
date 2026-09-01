/**
 * LOT ACTION — parcours citoyens du chemin texte (démo du 9 septembre).
 * « SUTA ne se contente plus de répondre : il aide le citoyen à agir. »
 *
 * Trois parcours courts et déterministes :
 * 1. SIGNALEMENT : la personne se plaint du réseau → SUTA demande la
 *    localité → enregistre → confirme ET oriente (point couvert le plus
 *    proche). Deux tours, toujours — court et robuste.
 * 2. POINT CONNECTÉ : « où est-ce que ça capte ? » → localité → réponse
 *    avec distances réelles (relevé de mai 2026).
 * 3. PRÉ-VÉRIFICATION PASS : les publics visés, honnêtement — jamais une
 *    promesse d'éligibilité (les critères officiels ne sont pas publiés).
 *
 * Module pur (aucune dépendance React) pour rester testable unitairement.
 * En session vocale, ces parcours sont portés par les outils signaler_zone
 * et point_connecte + le prompt — pas par ce module.
 */

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type ProblemeReseau = "pas_de_reseau" | "reseau_instable" | "pas_internet" | "autre";

/** La personne se plaint du réseau ou veut signaler → catégorie, sinon null. */
export function detecterSignalement(texte: string): ProblemeReseau | null {
  const t = normaliser(texte);
  if (/\b(signaler|je signale|faire remonter)\b/.test(t)) {
    if (/internet/.test(t)) return "pas_internet";
    if (/instable|coupe|faible|mauvais/.test(t)) return "reseau_instable";
    return "pas_de_reseau";
  }
  if (/\b(pas|plus|aucun) (de )?reseau\b|\bca (ne )?capte (pas|plus)\b|\breseau (ne marche|ne fonctionne) (pas|plus)\b/.test(t)) {
    return "pas_de_reseau";
  }
  if (/\breseau (est )?(instable|faible|mauvais)\b|\breseau coupe\b|\bca coupe tout le temps\b/.test(t)) {
    return "reseau_instable";
  }
  if (/\b(pas|plus) d ?internet\b|\binternet (ne marche|ne fonctionne) (pas|plus)\b/.test(t)) {
    return "pas_internet";
  }
  return null;
}

/** « Où est-ce que ça capte près de chez moi / sur ma route ? » */
export function detecterPointConnecte(texte: string): boolean {
  const t = normaliser(texte);
  return /\bpoint connecte\b|\blocalite couverte\b|\bou (est ce qu(e )?)?ca capte\b|\bprochain point (couvert|connecte)\b|\bendroit (couvert|ou ca capte)\b|\bou capter\b/.test(t);
}

/** « Suis-je éligible au PASS ? Ai-je droit au téléphone ? » */
export function detecterPassPrecheck(texte: string): boolean {
  const t = normaliser(texte);
  if (!/\bpass\b|\btelephone\b|\bsmartphone\b/.test(t)) return false;
  return /\b(suis je|je suis) (eligible|concerne)\b|\bai je droit\b|\bj ai droit\b|\bje peux (avoir|beneficier|en beneficier)\b|\by ai droit\b|\beligible\b/.test(t);
}

export const DEMANDE_LOCALITE_SIGNALEMENT =
  "Je peux transmettre votre signalement à l'ANSUT — il alimentera directement le suivi du réseau. Quel est le nom de la localité concernée ?";

export const DEMANDE_LOCALITE_POINT =
  "Je peux chercher où le réseau capte autour de vous. Donnez-moi le nom d'une localité de départ (votre village ou une ville proche).";

export const REPONSE_PRECHECK_PASS =
  "Le programme PASS vise d'abord : les personnes à faibles revenus en milieu rural ou périurbain, les jeunes déscolarisés et demandeurs d'emploi, les femmes en situation de précarité, les petits commerçants et artisans, et les acteurs du monde agricole. Si vous êtes dans l'une de ces situations, vous correspondez aux publics visés. Les critères officiels, les prix et les inscriptions seront annoncés par l'ANSUT — méfiez-vous de toute annonce qui ne vient pas d'elle. Voulez-vous que je vous explique comment se passera l'inscription ?";

interface ReponseSignalement {
  enregistre?: boolean;
  localiteReconnue?: string | null;
  region?: string | null;
  pointProche?: { nom?: string; distanceKm?: number } | null;
}

export function composerConfirmationSignalement(localiteDonnee: string, reponse: ReponseSignalement): string {
  if (!reponse?.enregistre) {
    return "Le signalement n'a pas pu être enregistré pour le moment. Réessayez dans un instant, ou adressez-vous à l'équipe présente.";
  }
  const nom = reponse.localiteReconnue ?? localiteDonnee;
  const ancre = reponse.localiteReconnue
    ? `votre signalement pour ${nom}${reponse.region ? ` (région ${reponse.region})` : ""} est transmis à l'ANSUT`
    : `votre signalement pour « ${localiteDonnee} » est transmis à l'ANSUT — je n'ai pas trouvé cette localité dans le référentiel, il sera vérifié à la main`;
  const orientation = reponse.pointProche?.nom
    ? ` En attendant, la localité couverte la plus proche est ${reponse.pointProche.nom}, à environ ${String(reponse.pointProche.distanceKm ?? "?").replace(".", ",")} km à vol d'oiseau.`
    : "";
  return `C'est noté : ${ancre}.${orientation} Merci — chaque signalement aide à améliorer le réseau.`;
}

interface ReponsePointConnecte {
  trouve?: boolean;
  localite?: { nom?: string; region?: string | null };
  couverteSurPlace?: boolean;
  points?: Array<{ nom?: string; departement?: string | null; distanceKm?: number }>;
}

export function composerPointConnecte(localiteDonnee: string, reponse: ReponsePointConnecte): string {
  if (!reponse?.trouve) {
    return `Je n'ai pas trouvé « ${localiteDonnee} » dans le référentiel des localités. Vérifiez l'orthographe, ou donnez-moi une ville proche.`;
  }
  const nom = reponse.localite?.nom ?? localiteDonnee;
  const points = (reponse.points ?? []).filter((p) => p.nom);
  if (reponse.couverteSurPlace) {
    const autres = points.slice(1, 3).map((p) => `${p.nom} (${String(p.distanceKm ?? "?").replace(".", ",")} km)`);
    return `Bonne nouvelle : ${nom} est couverte — au moins un site mobile est à moins de 3 km (relevé de mai 2026).${autres.length > 0 ? ` Autour, le réseau capte aussi à ${autres.join(" et ")}.` : ""} Je peux vous en dire plus si vous voulez.`;
  }
  if (points.length === 0) {
    return `Je n'ai pas trouvé de localité couverte proche de ${nom} dans le relevé. Je peux transmettre un signalement à l'ANSUT si vous voulez.`;
  }
  const [premier, ...suivants] = points;
  const suite = suivants.slice(0, 2).map((p) => `${p.nom} (${String(p.distanceKm ?? "?").replace(".", ",")} km)`);
  return `La localité couverte la plus proche de ${nom} est ${premier.nom}, à environ ${String(premier.distanceKm ?? "?").replace(".", ",")} km à vol d'oiseau${suite.length > 0 ? `, puis ${suite.join(" et ")}` : ""} (relevé de mai 2026, au moins un site mobile à moins de 3 km). Je peux transmettre un signalement à l'ANSUT pour ${nom} si vous voulez.`;
}
