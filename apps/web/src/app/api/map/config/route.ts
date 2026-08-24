import { azureMapsConfigured } from "@/lib/map/azure-maps";

/** Dit au navigateur quel fond de carte est disponible — jamais de clé,
 * juste un booléen. Sans AZURE_MAPS_KEY, la carte reste sur OpenStreetMap. */
export async function GET() {
  return Response.json({
    fondAzure: azureMapsConfigured(process.env as Record<string, string | undefined>),
  });
}
