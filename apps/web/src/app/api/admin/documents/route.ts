import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@suta/database";
import { ingestDocument } from "@suta/knowledge";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { listDocumentsForAdmin } from "@/lib/admin-documents";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo
const ADMIN_SOURCE_ID = "admin-upload";
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown"];

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }

  return Response.json({ documents: await listDocumentsForAdmin() });
}

export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "Aucun fichier fourni." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "Fichier trop volumineux (10 Mo maximum)." }, { status: 413 });
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return Response.json(
      { error: `Format non pris en charge : ${extension}. Formats acceptés : PDF, DOCX, TXT, MD.` },
      { status: 400 },
    );
  }

  const titleField = formData?.get("title");
  const title = typeof titleField === "string" && titleField.trim() ? titleField.trim() : file.name;

  await prisma.knowledgeSource.upsert({
    where: { id: ADMIN_SOURCE_ID },
    update: {},
    create: {
      id: ADMIN_SOURCE_ID,
      name: "Documents ajoutés via l'administration",
      type: "upload",
    },
  });

  const tempDir = await mkdtemp(join(tmpdir(), "suta-upload-"));
  const tempFilePath = join(tempDir, `document${extension}`);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempFilePath, buffer);

    const result = await ingestDocument({
      filePath: tempFilePath,
      title,
      visibility: "DEMO",
      sourceId: ADMIN_SOURCE_ID,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[api/admin/documents] échec de l'ingestion", error);
    return Response.json(
      { error: "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer." },
      { status: 503 },
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
