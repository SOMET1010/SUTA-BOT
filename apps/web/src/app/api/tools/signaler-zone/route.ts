import { signalerZoneInputSchema } from "@suta/tools";
import { edgeFunctionUrl, edgeHeaders } from "@/lib/supabase-edge";
import { gardeInstance } from "@/lib/pass/mode";

/**
 * Outil `signaler_zone` côté serveur — appelé par le chemin texte et par la
 * boucle d'outils vocale. Exécution UNIQUEMENT via l'Edge Function
 * `signaler-zone` (la table des signalements vit du côté du corpus,
 * verrouillée par RLS) : pas de secours local — si la fonction est
 * indisponible, on le dit, on ne fait pas semblant d'avoir enregistré.
 */
const EDGE_TIMEOUT_MS = 9_000;

export async function POST(request: Request) {
  // Isolation réciproque des instances (SUTA_MODE) : un déploiement PASS ou
  // Cockpit n'atteint pas les outils citoyens, même par une requête directe.
  const horsInstance = gardeInstance(process.env as Record<string, string | undefined>, "citoyen");
  if (horsInstance) return horsInstance;
  const body: unknown = await request.json().catch(() => null);
  const parsed = signalerZoneInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Signalement invalide (localité et problème requis)." }, { status: 400 });
  }
  const canal = (body as { canal?: unknown })?.canal === "voix" ? "voix" : "texte";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
  try {
    const response = await fetch(edgeFunctionUrl("signaler-zone"), {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ ...parsed.data, canal }),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || (data as { ok?: unknown }).ok !== true) {
      return Response.json(
        { error: "Le signalement n'a pas pu être enregistré pour le moment. Réessayez dans un instant." },
        { status: 503 },
      );
    }
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "Le signalement n'a pas pu être enregistré pour le moment. Réessayez dans un instant." },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
