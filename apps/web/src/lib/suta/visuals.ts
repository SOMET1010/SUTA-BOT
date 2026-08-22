/**
 * Ce que SUTA affiche pendant qu'il parle.
 *
 * La voix et l'ecran se completent : SUTA reste bref a l'oral et l'interface
 * prend en charge la precision visuelle. Les visuels sont des objets structures
 * controles par le frontend : le modele ne genere jamais de HTML libre.
 */

export interface VisualPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface SutaAction {
  id: string;
  label: string;
  prompt?: string;
}

export type SutaVisual =
  | {
      kind: "map";
      points: VisualPoint[];
      caption: string;
      status?: "connected" | "partial" | "planned" | "unknown";
      details?: string[];
      actions?: SutaAction[];
    }
  | {
      kind: "info-card";
      title: string;
      eyebrow?: string;
      summary: string;
      facts?: Array<{ label: string; value: string }>;
      actions?: SutaAction[];
    }
  | {
      kind: "steps";
      title: string;
      summary?: string;
      steps: Array<{ title: string; description?: string }>;
      actions?: SutaAction[];
    }
  | {
      kind: "program";
      title: string;
      pillar: "connecter" | "equiper" | "former";
      summary: string;
      eligibility?: string[];
      benefits?: string[];
      actions?: SutaAction[];
    }
  | {
      kind: "law-summary";
      title: string;
      summary: string;
      whatChanges: string[];
      concerned?: string[];
      actions?: SutaAction[];
    }
  | {
      kind: "alert";
      title: string;
      message: string;
      severity: "info" | "warning" | "critical";
      actions?: SutaAction[];
    };

/**
 * Forme minimale attendue d'un resultat de recherche. Ce type reste leger car
 * le module est charge dans le navigateur.
 */
export interface VisualisableResult {
  location?: VisualPoint;
}

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
  return `${points.length} localites`;
}

/**
 * Deduit un premier visuel des resultats de recherche. Cette fonction conserve
 * le comportement historique : seules de vraies coordonnees produisent une
 * carte. Les autres familles de visuels seront construites par la couche scene
 * a partir de donnees structurees provenant des outils.
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
