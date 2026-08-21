export interface SearchResultLocation {
  lat: number;
  lng: number;
  /** Nom à afficher sur la carte (nom de la localité ou de la région). */
  label: string;
}

/**
 * Extrait des coordonnées géographiques depuis les métadonnées d'un
 * fragment, si elles y figurent (ex. corpus observatoire ANSUT : `lat`,
 * `lng`, `nom`). Ne fabrique jamais de coordonnée : retourne `undefined`
 * si absentes ou invalides. Module séparé de `search.ts` (qui importe
 * `@suta/database`, non testable isolément sans `DATABASE_URL`) pour
 * rester testable.
 */
export function extractLocation(
  metadata: unknown,
  fallbackLabel: string,
): SearchResultLocation | undefined {
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const obj = metadata as Record<string, unknown>;
  const { lat, lng } = obj;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return undefined;
  }
  const label = typeof obj.nom === "string" && obj.nom.length > 0 ? obj.nom : fallbackLabel;
  return { lat, lng, label };
}
