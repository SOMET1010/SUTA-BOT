import { createRealtimeProvider } from "@suta/ai";
import { prisma } from "@suta/database";
import { createEmbeddingsProvider } from "@suta/knowledge";

/**
 * Endpoint de santé (cahier des charges, section 28). Ne révèle jamais de
 * secret : uniquement le nom du fournisseur configuré et un statut booléen.
 */
export async function GET() {
  let realtimeStatus: "ok" | "error" = "ok";
  try {
    createRealtimeProvider();
  } catch {
    realtimeStatus = "error";
  }

  let knowledgeStatus: "ok" | "error" = "ok";
  try {
    createEmbeddingsProvider();
  } catch {
    knowledgeStatus = "error";
  }

  let databaseStatus: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    databaseStatus = "error";
  }

  const allOk = realtimeStatus === "ok" && knowledgeStatus === "ok" && databaseStatus === "ok";

  return Response.json({
    status: allOk ? "ok" : "degraded",
    services: {
      database: databaseStatus,
      realtime: realtimeStatus,
      knowledge: knowledgeStatus,
    },
  });
}
