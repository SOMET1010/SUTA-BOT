import "dotenv/config";
import { resolve } from "node:path";
import { prisma } from "@suta/database";
import { ingestJsonlCorpus } from "../src/ingestion/ingest-jsonl";

const SOURCE_ID = "ansut-observatoire";

/**
 * `npm run knowledge:ingest-jsonl -- <chemin-vers-corpus.jsonl> [--limit N]`
 * Ingère un corpus RAG pré-découpé (format `ansut_rag_corpus.jsonl`,
 * observatoire du service universel ANSUT — scoring AIGF, couverture
 * opérateurs, population RGPH, synthèses régionales, doctrine métier).
 * Nécessite un vrai EMBEDDINGS_PROVIDER (azure ou openai) : avec
 * EMBEDDINGS_PROVIDER=mock, la recherche sémantique sur ce volume
 * (~8 700 fragments) ne serait pas exploitable.
 *
 * `--limit N` n'ingère que les N premières entrées — utile pour valider
 * le pipeline (déploiement d'embeddings, connexion base) avant de lancer
 * l'ingestion complète.
 */
async function main() {
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => !arg.startsWith("--"));
  const limitIndex = args.indexOf("--limit");
  const limit =
    limitIndex !== -1 && args[limitIndex + 1] ? Number.parseInt(args[limitIndex + 1], 10) : undefined;

  if (!fileArg) {
    console.error(
      "Usage : npm run knowledge:ingest-jsonl -- <chemin-vers-corpus.jsonl> [--limit N]",
    );
    process.exitCode = 1;
    return;
  }

  const filePath = resolve(fileArg);
  console.log(`Ingestion du corpus JSONL : ${filePath}${limit ? ` (limite : ${limit})` : ""}`);

  const result = await ingestJsonlCorpus({
    filePath,
    sourceId: SOURCE_ID,
    sourceName: "Observatoire ANSUT — service universel",
    sourceDescription:
      "Corpus généré depuis la base de données de l'observatoire ANSUT : " +
      "scoring AIGF, couverture opérateurs, population RGPH, synthèses " +
      "régionales et doctrine métier.",
    limit,
    onProgress: (done, total) => {
      console.log(`  ... ${done}/${total}`);
    },
  });

  for (const failure of result.parseFailed.slice(0, 20)) {
    console.error(`  ✗ ligne ${failure.line} : ${failure.error}`);
  }
  for (const failure of result.storeFailed.slice(0, 20)) {
    console.error(`  ✗ ${failure.id} : ${failure.error}`);
  }
  const parseOverflow = result.parseFailed.length - 20;
  const storeOverflow = result.storeFailed.length - 20;
  if (parseOverflow > 0) console.error(`  ... et ${parseOverflow} autre(s) erreur(s) de parsing.`);
  if (storeOverflow > 0) console.error(`  ... et ${storeOverflow} autre(s) échec(s) de stockage.`);

  console.log(
    `Terminé : ${result.succeeded}/${result.total} fragment(s) indexé(s), ` +
      `${result.parseFailed.length} erreur(s) de parsing, ${result.storeFailed.length} échec(s) de stockage.`,
  );

  if (result.parseFailed.length > 0 || result.storeFailed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Échec de l'ingestion JSONL :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
