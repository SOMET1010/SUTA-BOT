import "dotenv/config";
import { resolve } from "node:path";
import { prisma } from "@suta/database";
import { ingestDirectory } from "../src/ingestion/ingest-directory";

/**
 * `npm run knowledge:ingest [-- <dossier>] [-- --source <id>]`
 * Par défaut, ingère le dossier `/data/demo` du monorepo (cahier des
 * charges, section 49).
 */
async function main() {
  const args = process.argv.slice(2);
  const dirArg = args.find((arg) => !arg.startsWith("--"));
  const targetDir = resolve(dirArg ?? resolve(import.meta.dirname, "../../../data/demo"));

  console.log(`Ingestion du dossier : ${targetDir}`);
  const result = await ingestDirectory(targetDir, { sourceId: "demo-salon" });

  for (const doc of result.succeeded) {
    console.log(`  ✓ ${doc.title} — ${doc.chunkCount} fragment(s) (document ${doc.documentId})`);
  }
  for (const failure of result.failed) {
    console.error(`  ✗ ${failure.filePath} : ${failure.error}`);
  }

  console.log(
    `Terminé : ${result.succeeded.length} document(s) indexé(s), ${result.failed.length} échec(s).`,
  );

  if (result.failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Échec de l'ingestion :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
