import { pointConnecteInputSchema } from "@suta/tools";
import { edgeFunctionUrl, edgeHeaders } from "@/lib/supabase-edge";
import { gardeInstance } from "@/lib/pass/mode";

/**
 * Outil `point_connecte` côté serveur — « où est-ce que ça capte près de
 * chez moi ? ». Exécution via l'Edge Function `point-connecte` (lecture
 * seule sur le relevé opérateurs géolocalisé de mai 2026).
 */
const EDGE_TIMEOUT_MS = 9_000;

export async function POST(request: Request) {
  // Isolation réciproque des instances (SUTA_MODE) : un déploiement PASS ou
  // Cockpit n'atteint pas les outils citoyens, même par une requête directe.
  const horsInstance = gardeInstance(process.env as Record<string, string | undefined>, "citoyen");
  if (horsInstance) return horsInstance;
  const body: unknown = await request.json().catch(() => null);
  const parsed = pointConnecteInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Donnez le nom d'une localité." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
  try {
    const response = await fetch(edgeFunctionUrl("point-connecte"), {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify(parsed.data),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || (data as { ok?: unknown }).ok !== true) {
      return Response.json(
        { error: "La recherche de proximité est momentanément indisponible." },
        { status: 503 },
      );
    }
    return Response.json(data);
  } catch {
    return Response.json(
      { error: "La recherche de proximité est momentanément indisponible." },
      { status: 503 },
    );
  } finally {
    clearTimeout(timer);
  }
}
