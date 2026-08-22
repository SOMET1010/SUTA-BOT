import { createRealtimeProvider } from "@suta/ai";
import { prisma } from "@suta/database";
import { createEmbeddingsProvider } from "@suta/knowledge";
import { probeSearchKnowledge } from "@/lib/supabase-edge";

async function safeCheck(check: () => unknown | Promise<unknown>): Promise<boolean> {
  try { await check(); return true; } catch { return false; }
}

/** Health-check de production : aucun secret ni detail d'infrastructure. */
export async function GET() {
  const [realtime, knowledge, database, documentCount, rechercheCorpus] = await Promise.all([
    safeCheck(() => createRealtimeProvider()),
    safeCheck(() => createEmbeddingsProvider()),
    safeCheck(() => prisma.$queryRaw`SELECT 1`),
    prisma.document.count().catch(() => 0),
    probeSearchKnowledge(),
  ]);

  const knowledgeLoaded = documentCount > 0;
  // Distingue la base d'amorçage (quelques documents fictifs de /data/demo)
  // du corpus réel (~10 000 fiches) : en salon, une DATABASE_URL pointant sur
  // la mauvaise base passait tous les checks et SUTA répondait du contenu de
  // démonstration. Le seuil est volontairement bas : il sépare des ordres de
  // grandeur, pas des versions du corpus.
  const corpusComplet = documentCount >= 1000;
  // La recherche citoyenne passe par l'Edge Function Supabase (chemin de
  // production) ; le corpus Prisma local n'est plus qu'un secours. Le service
  // est donc « prêt » dès que l'un des deux chemins de connaissance répond.
  const ready = realtime && (rechercheCorpus || (database && knowledgeLoaded));
  const degraded = (database || rechercheCorpus) && (realtime || knowledge);

  return Response.json({
    status: ready ? "ready" : degraded ? "degraded" : "unavailable",
    checks: { realtime, knowledge, database, knowledgeLoaded, corpusComplet, rechercheCorpus },
    documents: documentCount,
    timestamp: new Date().toISOString(),
  }, { status: ready || degraded ? 200 : 503 });
}
