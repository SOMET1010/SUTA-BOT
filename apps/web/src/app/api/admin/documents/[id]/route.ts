import { prisma } from "@suta/database";
import { hasValidAdminSession } from "@/lib/admin-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }

  const { id } = await params;

  try {
    // onDelete: Cascade sur DocumentChunk.documentId supprime les fragments associés.
    await prisma.document.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[api/admin/documents/:id] échec de la suppression", error);
    return Response.json({ error: "Document introuvable ou déjà supprimé." }, { status: 404 });
  }
}
