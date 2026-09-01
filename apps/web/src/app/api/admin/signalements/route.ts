import { hasValidAdminSession } from "@/lib/admin-auth";
import { edgeFunctionUrl, edgeHeaders } from "@/lib/supabase-edge";

/**
 * Signalements citoyens pour le tableau de bord admin (LOT ACTION).
 * Double protection : le proxy garde /api/admin, et la session est
 * revérifiée ici (défense en profondeur, comme les autres routes admin).
 */
export async function GET() {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }
  try {
    const response = await fetch(edgeFunctionUrl("signalements-recents"), {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ limite: 100 }),
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || (data as { ok?: unknown }).ok !== true) {
      return Response.json({ error: "Lecture des signalements indisponible." }, { status: 503 });
    }
    return Response.json(data);
  } catch {
    return Response.json({ error: "Lecture des signalements indisponible." }, { status: 503 });
  }
}
