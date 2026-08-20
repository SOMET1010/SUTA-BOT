import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import type { SourceType } from "@suta/database";

/**
 * Détermine le type de source à partir de l'extension de fichier (cahier
 * des charges, section 14 : PDF, DOCX, TXT, Markdown).
 */
export function detectSourceType(filePath: string): SourceType {
  switch (extname(filePath).toLowerCase()) {
    case ".pdf":
      return "PDF";
    case ".docx":
      return "DOCX";
    case ".md":
    case ".markdown":
      return "MARKDOWN";
    case ".txt":
      return "TXT";
    default:
      throw new Error(
        `Extension de fichier non prise en charge : "${filePath}". ` +
          "Formats supportés : .pdf, .docx, .txt, .md.",
      );
  }
}

export function mimeTypeForSourceType(sourceType: SourceType): string {
  switch (sourceType) {
    case "PDF":
      return "application/pdf";
    case "DOCX":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "MARKDOWN":
      return "text/markdown";
    case "TXT":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

/**
 * Extrait le texte brut d'un fichier PDF/DOCX/TXT/MD. Aucune bibliothèque
 * externe n'est appelée en réseau : tout se passe localement.
 */
export async function extractText(filePath: string, sourceType?: SourceType): Promise<string> {
  const type = sourceType ?? detectSourceType(filePath);

  switch (type) {
    case "PDF": {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = await readFile(filePath);
      const result = await pdfParse(buffer);
      return result.text;
    }
    case "DOCX": {
      const mammoth = await import("mammoth");
      const buffer = await readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "TXT":
    case "MARKDOWN":
      return readFile(filePath, "utf-8");
    default:
      throw new Error(`Type de source non pris en charge : ${type}`);
  }
}
