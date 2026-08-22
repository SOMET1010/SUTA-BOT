/**
 * Mise en forme des résultats `search_knowledge` avant leur retour au modèle
 * vocal (function_call_output).
 *
 * Constat de salon : en recevant les fiches brutes, le modèle les récitait —
 * pour « mon village est-il connecté ? », il déroulait population, écoles,
 * électrification et distances en mètres au lieu de répondre. Deux leviers
 * ici : (1) les contenus sont présentés comme des PREUVES, avec une consigne
 * de synthèse orientée question ; (2) seuls les premiers résultats passent —
 * au-delà, on nourrit la récitation, pas la réponse.
 *
 * Module pur (aucune dépendance React) pour rester testable unitairement.
 */

/** Au-delà de trois fiches, le modèle inventorie au lieu de synthétiser. */
const MAX_PREUVES = 3;

export const CONSIGNE_SYNTHESE =
  "Ces textes sont des preuves, pas une réponse : ne les récite jamais. " +
  "Réponds uniquement à la question posée, en une à trois phrases orales " +
  "simples, avec les seuls faits qui y répondent — tais tout le reste, même " +
  "exact. Puis propose d'en dire plus si c'est utile. Jamais de document, " +
  "de fiche, de source ni de coordonnées.";

interface ResultatBrut {
  content?: unknown;
}

/**
 * Rend la charge utile envoyée au modèle. Toute forme inattendue est rendue
 * telle quelle : une erreur d'outil (`{ error }`) doit parvenir au modèle
 * pour qu'il dise honnêtement qu'il n'a pas trouvé.
 */
export function shapeKnowledgeForModel(result: unknown): unknown {
  if (
    result &&
    typeof result === "object" &&
    "results" in result &&
    Array.isArray((result as { results: unknown[] }).results)
  ) {
    const preuves = (result as { results: ResultatBrut[] }).results
      .map((r) => (typeof r.content === "string" ? r.content : null))
      .filter((c): c is string => c !== null)
      .slice(0, MAX_PREUVES);
    return { preuves, consigne: CONSIGNE_SYNTHESE };
  }
  return result;
}
