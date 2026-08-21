import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { SourceType } from "@suta/database";
import { splitHeaderAndRows, workbookToText, type SheetData } from "./spreadsheet.ts";

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
    case ".xlsx":
    case ".xls":
    case ".csv":
      return "SPREADSHEET";
    default:
      throw new Error(
        `Extension de fichier non prise en charge : "${filePath}". ` +
          "Formats supportés : .pdf, .docx, .txt, .md, .xlsx, .xls, .csv.",
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
    case "SPREADSHEET":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    default:
      return "application/octet-stream";
  }
}

/** Rend une cellule sous forme de chaîne, quel que soit son type Excel. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    // Cellules riches d'Excel : formule (on garde le résultat), texte
    // enrichi, lien hypertexte. Sans cela on écrirait « [object Object] ».
    const cell = value as Record<string, unknown>;
    if ("result" in cell) return cellToString(cell.result);
    if ("text" in cell) return cellToString(cell.text);
    if ("richText" in cell && Array.isArray(cell.richText)) {
      return cell.richText.map((part) => cellToString((part as { text?: unknown }).text)).join("");
    }
    if ("hyperlink" in cell) return cellToString(cell.hyperlink);
    return "";
  }
  return String(value);
}

async function extractSpreadsheetText(filePath: string): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();

  const isCsv = extname(filePath).toLowerCase() === ".csv";
  if (isCsv) {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  // Un CSV n'a pas de nom de feuille : exceljs en invente un (« sheet1 »),
  // qui serait répété en tête de chaque ligne sans rien apporter. Le nom du
  // fichier, lui, porte du sens.
  const csvLabel = isCsv ? basename(filePath, extname(filePath)) : null;

  const sheets: SheetData[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellToString));
    });
    const { headers, rows: body } = splitHeaderAndRows(rows);
    if (headers.length > 0) {
      sheets.push({ name: csvLabel ?? worksheet.name, headers, rows: body });
    }
  });

  return workbookToText(sheets);
}

/**
 * Extrait le texte brut d'un fichier PDF/DOCX/TXT/MD/tableur. Aucune
 * bibliothèque externe n'est appelée en réseau : tout se passe localement.
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
    case "SPREADSHEET":
      return extractSpreadsheetText(filePath);
    default:
      throw new Error(`Type de source non pris en charge : ${type}`);
  }
}
