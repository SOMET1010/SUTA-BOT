import { runTool, searchKnowledgeTool, ToolInputError, searchKnowledgeInputSchema } from "@suta/tools";

/**
 * Outil `search_knowledge` côté serveur — appelé par le navigateur pendant
 * une session vocale (boucle d'outils Realtime) et par /admin/knowledge.
 *
 * CHEMIN DE PRODUCTION : l'Edge Function Supabase `search-knowledge`, qui
 * vit du même côté que le corpus (même base, même modèle d'embedding).
 * Leçon du salon : la base injectée par l'hébergeur (intégration Neon de
 * Vercel) n'était pas celle du corpus, et SUTA répondait depuis les
 * documents fictifs d'amorçage. En passant par la fonction, il n'y a plus
 * AUCUNE configuration de base ni d'embeddings à aligner côté Vercel.
 *
 * La clé ci-dessous est la clé PUBLIABLE du projet (conçue pour être
 * exposée) : les tables sont verrouillées par RLS sans policy, elle ne
 * permet donc que d'invoquer les fonctions — et `search-knowledge` impose
 * côté serveur la visibilité PUBLIC+DEMO, quoi que demande l'appelant.
 *
 * Le chemin local Prisma reste en secours : développement hors ligne, ou
 * indisponibilité passagère de la fonction.
 */
import { edgeFunctionUrl, edgeHeaders } from "@/lib/supabase-edge";

const EDGE_TIMEOUT_MS = 9_000;

interface EdgeResult {
  title?: unknown; source?: unknown; score?: unknown; content?: unknown; extrait?: unknown;
  location?: { lat?: unknown; lng?: unknown; label?: unknown };
}

function mapEdgeResults(raw: unknown): { results: unknown[] } | null {
  if (!raw || typeof raw !== "object" || !("results" in raw)) return null;
  const list = (raw as { results: unknown }).results;
  if (!Array.isArray(list)) return null;
  return {
    results: (list as EdgeResult[]).map((r) => ({
      title: typeof r.title === "string" ? r.title : "",
      content: typeof r.content === "string" ? r.content : typeof r.extrait === "string" ? r.extrait : "",
      source: typeof r.source === "string" ? r.source : "Corpus ANSUT",
      score: typeof r.score === "number" ? r.score : 0,
      ...(r.location && typeof r.location.lat === "number" && typeof r.location.lng === "number"
        ? { location: { lat: r.location.lat, lng: r.location.lng, label: typeof r.location.label === "string" ? r.location.label : "" } }
        : {}),
    })),
  };
}

async function searchViaEdge(query: string, limit: number | undefined): Promise<{ results: unknown[] } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EDGE_TIMEOUT_MS);
  try {
    const response = await fetch(edgeFunctionUrl("search-knowledge"), {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || (data as { ok?: unknown }).ok !== true) return null;
    return mapEdgeResults(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  const parsed = searchKnowledgeInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Paramètres de recherche invalides." }, { status: 400 });
  }

  const viaEdge = await searchViaEdge(parsed.data.query, parsed.data.limit);
  if (viaEdge) return Response.json(viaEdge);

  // Secours : chemin Prisma local (développement, ou fonction indisponible).
  try {
    console.warn("[api/tools/search-knowledge] Edge Function indisponible — recours au chemin Prisma local.");
    const result = await runTool(searchKnowledgeTool, body);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ToolInputError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/tools/search-knowledge] échec de l'exécution", error);
    return Response.json(
      {
        error:
          "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.",
      },
      { status: 503 },
    );
  }
}
