import "dotenv/config";
import { prisma } from "../src/client.ts";

/**
 * Semis minimal : crée la source de connaissance par défaut utilisée par le
 * dataset de démonstration Salon (`npm run knowledge:ingest`, section 49 du
 * cahier des charges). Aucune donnée utilisateur n'est semée pour l'instant
 * (pas d'authentification dans le MVP).
 */
async function main() {
  const source = await prisma.knowledgeSource.upsert({
    where: { id: "demo-salon" },
    update: {},
    create: {
      id: "demo-salon",
      name: "Corpus de démonstration Salon",
      type: "manual",
      description:
        "Documents d'exemple utilisés pour le MVP Salon, non validés par l'ANSUT.",
    },
  });
  console.log(`Source de connaissance prête : ${source.name} (${source.id})`);
}

main()
  .catch((error) => {
    console.error("Échec du semis :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
