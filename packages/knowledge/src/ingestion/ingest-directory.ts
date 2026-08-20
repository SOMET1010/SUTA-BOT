import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Visibility } from "@suta/database";
import { createEmbeddingsProvider } from "../embeddings/factory";
import type { EmbeddingsProvider } from "../embeddings/types";
import { ingestDocument, type IngestDocumentResult } from "./ingest";

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".txt", ".md", ".markdown"]);

export interface IngestDirectoryOptions {
  visibility?: Visibility;
  sourceId?: string;
}

export interface IngestDirectoryResult {
  succeeded: IngestDocumentResult[];
  failed: { filePath: string; error: string }[];
}

/**
 * Ingère tous les fichiers pris en charge d'un dossier (utilisé pour
 * `/data/demo`, cahier des charges section 49). Une même instance
 * d'EmbeddingsProvider est réutilisée pour tout le dossier ; un échec sur un
 * fichier n'interrompt pas les suivants.
 */
export async function ingestDirectory(
  dirPath: string,
  options: IngestDirectoryOptions = {},
): Promise<IngestDirectoryResult> {
  const provider: EmbeddingsProvider = createEmbeddingsProvider();
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()) &&
        entry.name.toLowerCase() !== "readme.md",
    )
    .map((entry) => join(dirPath, entry.name));

  const succeeded: IngestDocumentResult[] = [];
  const failed: { filePath: string; error: string }[] = [];

  for (const filePath of files) {
    try {
      const result = await ingestDocument({
        filePath,
        visibility: options.visibility,
        sourceId: options.sourceId,
        embeddingsProvider: provider,
      });
      succeeded.push(result);
    } catch (error) {
      failed.push({
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { succeeded, failed };
}
