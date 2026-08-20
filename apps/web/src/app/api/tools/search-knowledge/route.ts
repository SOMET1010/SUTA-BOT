import { runTool, searchKnowledgeTool, ToolInputError } from "@suta/tools";

/**
 * Endpoint de test/diagnostic pour l'outil `search_knowledge` (cahier des
 * charges, section 17). Exécute le même code que celui enregistré auprès du
 * moteur Realtime (section 18) — utile en développement, et destiné à
 * servir de base à « Tester une question » sur `/admin/knowledge` (Lot 6).
 *
 * Ne renvoie jamais le détail d'une erreur interne au client (section 33).
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);

  try {
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
