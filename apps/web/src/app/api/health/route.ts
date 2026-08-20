import { createRealtimeProvider } from "@suta/ai";

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

  return Response.json({
    status: realtimeStatus === "ok" ? "ok" : "degraded",
    services: {
      // La base de données et la base de connaissances seront ajoutées au Lot 4.
      database: "not_configured",
      realtime: realtimeStatus,
      knowledge: "not_configured",
    },
  });
}
