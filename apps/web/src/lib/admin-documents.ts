import { prisma } from "@suta/database";

export interface AdminDocumentSummary {
  id: string;
  title: string;
  filename: string;
  sourceType: string;
  visibility: string;
  status: string;
  chunkCount: number;
  createdAt: string;
  indexedAt: string | null;
}

export async function listDocumentsForAdmin(): Promise<AdminDocumentSummary[]> {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    sourceType: doc.sourceType,
    visibility: doc.visibility,
    status: doc.status,
    chunkCount: doc._count.chunks,
    createdAt: doc.createdAt.toISOString(),
    indexedAt: doc.indexedAt?.toISOString() ?? null,
  }));
}
