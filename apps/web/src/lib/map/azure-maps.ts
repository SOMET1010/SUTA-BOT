/**
 * Azure Maps — le fond de carte et le géocodage de SUTA (réponse au retour
 * de la direction du 24/08 : « la carte est générique »).
 *
 * Même architecture que la voix (lot 3) : la clé AZURE_MAPS_KEY ne quitte
 * JAMAIS le serveur — le navigateur passe par nos routes relais
 * (/api/map/tile, /api/map/geocode). Ce module ne fait que construire les
 * URL Azure (pur, testable sans réseau) ; sans clé, tout est inerte et la
 * carte garde son fond OpenStreetMap actuel.
 */

export function azureMapsConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(env.AZURE_MAPS_KEY);
}

/** Tuile raster du fond routier Microsoft (Render V2, api-version 2.1),
 * étiquettes en français. z/x/y validés strictement : ces valeurs viennent
 * de l'URL publique du relais. */
export function construireUrlTuile(
  { z, x, y }: { z: number; x: number; y: number },
  env: Record<string, string | undefined>,
): string {
  const key = env.AZURE_MAPS_KEY;
  if (!key) throw new Error("Azure Maps non configuré (AZURE_MAPS_KEY).");
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error("Coordonnées de tuile invalides.");
  }
  const cote = 2 ** z;
  if (z < 0 || z > 22 || x < 0 || x >= cote || y < 0 || y >= cote) {
    throw new Error("Coordonnées de tuile hors limites.");
  }
  const url = new URL("https://atlas.microsoft.com/map/tile");
  url.search = new URLSearchParams({
    "api-version": "2.1",
    tilesetId: "microsoft.base.road",
    zoom: String(z),
    x: String(x),
    y: String(y),
    tileSize: "256",
    language: "fr-FR",
    view: "Auto",
    "subscription-key": key,
  }).toString();
  return url.toString();
}

/** Recherche d'une localité, bornée à la Côte d'Ivoire (countrySet=CI) —
 * une localité ambiguë ne doit jamais résoudre vers un autre pays. */
export function construireUrlGeocode(query: string, env: Record<string, string | undefined>): string {
  const key = env.AZURE_MAPS_KEY;
  if (!key) throw new Error("Azure Maps non configuré (AZURE_MAPS_KEY).");
  const url = new URL("https://atlas.microsoft.com/search/address/json");
  url.search = new URLSearchParams({
    "api-version": "1.0",
    query,
    countrySet: "CI",
    language: "fr-FR",
    limit: "5",
    "subscription-key": key,
  }).toString();
  return url.toString();
}

export interface LocaliteTrouvee {
  label: string;
  lat: number;
  lng: number;
  score: number;
}

/** Réduit la réponse Azure Search au strict nécessaire pour SUTA. */
export function extraireLocalites(reponse: unknown): LocaliteTrouvee[] {
  if (typeof reponse !== "object" || reponse === null) return [];
  const results = (reponse as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];
  const localites: LocaliteTrouvee[] = [];
  for (const item of results) {
    if (typeof item !== "object" || item === null) continue;
    const { position, address, score } = item as {
      position?: { lat?: unknown; lon?: unknown };
      address?: { freeformAddress?: unknown; municipality?: unknown };
      score?: unknown;
    };
    const lat = typeof position?.lat === "number" ? position.lat : null;
    const lng = typeof position?.lon === "number" ? position.lon : null;
    const label =
      typeof address?.municipality === "string" && address.municipality
        ? address.municipality
        : typeof address?.freeformAddress === "string"
          ? address.freeformAddress
          : null;
    if (lat === null || lng === null || !label) continue;
    localites.push({ label, lat, lng, score: typeof score === "number" ? score : 0 });
  }
  return localites;
}
