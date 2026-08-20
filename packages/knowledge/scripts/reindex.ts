import "dotenv/config";
import { prisma } from "@suta/database";
import { reindexAllChunks } from "../src/ingestion/reindex";

/**
 * `npm run knowledge:reindex` — recalcule les embeddings de tous les
 * fragments existants avec le fournisseur actuellement configuré.
 */
async function main() {
  console.log("Réindexation des fragments existants...");
  const result = await reindexAllChunks();
  console.log(`Terminé : ${result.chunkCount} fragment(s) réindexé(s).`);
}

main()
  .catch((error) => {
    console.error("Échec de la réindexation :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
