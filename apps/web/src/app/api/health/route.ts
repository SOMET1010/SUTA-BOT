import { createRealtimeProvider } from "@suta/ai";
import { prisma } from "@suta/database";
import { createEmbeddingsProvider } from "@suta/knowledge";

async function safeCheck(check: () => unknown | Promise<unknown>): Promise<boolean> {
  try { await check(); return true; } catch { return false; }
}

/** Health-check de production : aucun secret ni detail d'infrastructure. */
export async function GET() {
  const [realtime, knowledge, database, documentCount] = await Promise.all([
    safeCheck(() => createRealtimeProvider()),
    safeCheck(() => createEmbeddingsProvider()),
    safeCheck(() => prisma.$queryRaw`SELECT 1`),
    prisma.document.count().catch(() => 0),
  ]);

  const knowledgeLoaded = documentCount > 0;
  const ready = realtime && knowledge && database && knowledgeLoaded;
  const degraded = database && (realtime || knowledge);

  return Response.json({
    status: ready ? "ready" : degraded ? "degraded" : "unavailable",
    checks: { realtime, knowledge, database, knowledgeLoaded },
    timestamp: new Date().toISOString(),
  }, { status: ready || degraded ? 200 : 503 });
}
