/**
 * Edge Function `point-connecte` — LOT ACTION (démo du 9 septembre).
 *
 * « Où est-ce que ça capte près de chez moi ? » : depuis une localité
 * nommée, rend sa propre situation de couverture (relevé de mai 2026) et
 * les localités COUVERTES (au moins un site mobile à moins de 3 km) les
 * plus proches, avec la distance à vol d'oiseau.
 *
 * Aucune donnée personnelle, lecture seule, visibilité PUBLIC/DEMO imposée
 * dans les fonctions SQL appelées.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const LOCALITE_MAX = 80;
const K_MAX = 5;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret manquant : ${name}.`);
  return value;
}

Deno.serve(async (req: Request) => {
  try {
    const corps = await req.json();
    const localite = typeof corps?.localite === "string" ? corps.localite.trim().slice(0, LOCALITE_MAX) : "";
    const k = Math.min(Math.max(Number(corps?.k) || 3, 1), K_MAX);
    if (localite.length < 2) throw new Error("Paramètre « localite » requis.");

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: resolue, error: erreurResolution } = await supabase.rpc("resoudre_localite", { nom_brut: localite });
    if (erreurResolution) throw new Error(`Résolution : ${erreurResolution.message}`);
    const lieu = Array.isArray(resolue) && resolue.length > 0 ? resolue[0] : null;
    if (!lieu || typeof lieu.lat !== "number" || typeof lieu.lng !== "number") {
      return Response.json({ ok: true, trouve: false, localite });
    }

    const { data: proches, error: erreurProches } = await supabase.rpc("points_connectes_proches", {
      p_lat: lieu.lat, p_lng: lieu.lng, k,
    });
    if (erreurProches) throw new Error(`Proximité : ${erreurProches.message}`);

    const points = (Array.isArray(proches) ? proches : []).map((p) => ({
      nom: p.nom,
      departement: p.departement,
      region: p.region,
      distanceKm: p.distance_km,
      lat: p.lat,
      lng: p.lng,
      extrait: typeof p.extrait === "string" ? p.extrait.slice(0, 400) : "",
    }));

    // La situation de la localité elle-même : couverte si elle est le
    // premier point rendu à distance nulle.
    const surPlace = points.length > 0 && points[0].distanceKm === 0 ? points[0] : null;

    return Response.json({
      ok: true,
      trouve: true,
      localite: { nom: lieu.nom, departement: lieu.departement, region: lieu.region, lat: lieu.lat, lng: lieu.lng },
      couverteSurPlace: Boolean(surPlace),
      points,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
