import { reindexAllChunks } from "@suta/knowledge";
import { hasValidAdminSession } from "@/lib/admin-auth";

export async function POST() {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }

  try {
    const result = await reindexAllChunks();
    return Response.json(result);
  } catch (error) {
    console.error("[api/admin/reindex] échec de la réindexation", error);
    return Response.json(
      { error: "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer." },
      { status: 503 },
    );
  }
}
