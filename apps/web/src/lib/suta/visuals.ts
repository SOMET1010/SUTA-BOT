/**
 * Ce que SUTA affiche à côté de sa parole.
 *
 * La voix et l'écran ne se concurrencent pas : ce que l'écran montre, SUTA
 * n'a pas à l'énumérer. C'est ce qui permet des réponses orales courtes sans
 * perdre en précision.
 *
 * Type ouvert : la carte est le premier écran, pas le seul prévu.
 */
export type SutaVisual = {
  kind: "map";
  points: VisualPoint[];
  /** Phrase courte décrivant ce que la carte montre. */
  caption: string;
};

export interface VisualPoint {
  lat: number;
  lng: number;
  label: string;
}

/**
 * Forme minimale attendue d'un résultat de recherche. Volontairement décrite
 * ici plutôt qu'importée de `@suta/tools` : ce module est chargé par le
 * navigateur, et cet import entraînerait toute la chaîne serveur (Prisma,
 * accès base) dans le paquet client.
 */
export interface VisualisableResult {
  location?: VisualPoint;
}

/** Deux fragments d'un même lieu ne doivent pas produire deux marqueurs. */
function dedupePoints(points: VisualPoint[]): VisualPoint[] {
  const seen = new Set<string>();
  const unique: VisualPoint[] = [];
  for (const point of points) {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(point);
  }
  return unique;
}

function caption(points: VisualPoint[]): string {
  if (points.length === 1) return points[0].label;
  return `${points.length} localités`;
}

/**
 * Déduit l'écran à afficher des résultats de recherche.
 *
 * Rien n'est inventé : seuls les fragments portant de vraies coordonnées
 * produisent un marqueur. Une question de doctrine, qui n'a pas de dimension
 * géographique, n'affiche donc aucune carte — plutôt qu'une carte vide ou,
 * pire, une carte plausible mais fausse.
 */
export function visualFromSearchResults(results: VisualisableResult[]): SutaVisual | null {
  const points = dedupePoints(
    results
      .map((result) => result.location)
      .filter((location): location is VisualPoint => Boolean(location)),
  );

  if (points.length === 0) return null;
  return { kind: "map", points, caption: caption(points) };
}
