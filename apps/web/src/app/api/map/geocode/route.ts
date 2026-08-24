import { hasValidAdminSession } from "@/lib/admin-auth";
import { azureMapsConfigured, construireUrlGeocode, extraireLocalites } from "@/lib/map/azure-maps";

/**
 * Géocodage d'une localité ivoirienne (countrySet=CI), clé côté serveur.
 * Réservé à l'admin pour l'instant : chaque appel est une transaction Azure
 * facturable, et rien côté public ne le consomme encore — le branchement
 * dans la conversation (préciser la carte des localités du corpus) se fera
 * côté serveur, pas depuis le navigateur du public.
 *
 * Cache en mémoire par instance : les mêmes localités reviennent sans
 * refacturer. Volontairement simple (pas de TTL : une localité ne bouge pas).
 */
const cache = new Map<string, unknown>();
const CACHE_MAX = 500;

export async function GET(request: Request) {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }
  const env = process.env as Record<string, string | undefined>;
  if (!azureMapsConfigured(env)) {
    return Response.json({ error: "Géocodage Azure non configuré (AZURE_MAPS_KEY)." }, { status: 503 });
  }
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q || q.length > 120) {
    return Response.json({ error: "Donnez une localité à chercher (q), 120 caractères maximum." }, { status: 400 });
  }
  const cleCache = q.toLowerCase();
  if (cache.has(cleCache)) {
    return Response.json({ localites: cache.get(cleCache), cache: true });
  }
  try {
    const reponse = await fetch(construireUrlGeocode(q, env));
    if (!reponse.ok) {
      console.error("[api/map/geocode] refus Azure Maps", reponse.status);
      return Response.json({ error: `Géocodage refusé (HTTP ${reponse.status}).` }, { status: 502 });
    }
    const localites = extraireLocalites(await reponse.json());
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(cleCache, localites);
    return Response.json({ localites });
  } catch (error) {
    console.error("[api/map/geocode] échec", error);
    return Response.json(
      { error: "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer." },
      { status: 503 },
    );
  }
}
