import { azureMapsConfigured, construireUrlTuile } from "@/lib/map/azure-maps";

/**
 * Relais de tuiles Azure Maps : le navigateur demande /api/map/tile/z/x/y,
 * le serveur ajoute la clé et renvoie l'image. La clé ne paraît jamais dans
 * une URL côté client. Cache long : une tuile de fond de carte ne change
 * pas — le CDN de Vercel absorbe l'essentiel des demandes répétées, donc
 * l'essentiel du coût par transaction Azure.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const env = process.env as Record<string, string | undefined>;
  if (!azureMapsConfigured(env)) {
    return Response.json({ error: "Fond de carte Azure non configuré (AZURE_MAPS_KEY)." }, { status: 404 });
  }
  const { z, x, y } = await params;
  let url: string;
  try {
    url = construireUrlTuile({ z: Number(z), x: Number(x), y: Number(y) }, env);
  } catch {
    return Response.json({ error: "Coordonnées de tuile invalides." }, { status: 400 });
  }
  const tuile = await fetch(url).catch(() => null);
  if (!tuile || !tuile.ok || !tuile.body) {
    if (tuile) console.error("[api/map/tile] refus Azure Maps", tuile.status);
    return Response.json({ error: "Tuile indisponible." }, { status: 502 });
  }
  return new Response(tuile.body, {
    headers: {
      "Content-Type": tuile.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    },
  });
}
