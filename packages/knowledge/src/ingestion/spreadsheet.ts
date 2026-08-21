/**
 * Mise en texte d'un tableur (Excel, CSV) pour la recherche sémantique.
 *
 * Un tableau n'est pas de la prose. Aplatir une feuille en vrac —
 * « BIAKALE 5681 TONKPI Orange » — produit des vecteurs qui ne portent aucun
 * sens : rien n'indique que 5681 est une population ni que TONKPI est une
 * région. Chaque ligne est donc rendue **auto-descriptive**, en réassociant
 * l'en-tête de colonne à sa valeur, de sorte qu'une ligne isolée reste
 * compréhensible et donc retrouvable.
 *
 * Module sans dépendance (la lecture du fichier est faite ailleurs), pour
 * rester testable sans fichier réel.
 */

/** Valeur de cellule déjà normalisée en chaîne par le lecteur de fichier. */
export type SheetCell = string;

export interface SheetData {
  name: string;
  /** Première ligne non vide, tenue pour l'en-tête. */
  headers: SheetCell[];
  rows: SheetCell[][];
}

function isBlank(cell: SheetCell | undefined): boolean {
  return cell === undefined || cell.trim().length === 0;
}

/**
 * Rend une ligne sous la forme « En-tête : valeur ; En-tête : valeur ».
 * Les colonnes vides sont omises : les tableurs administratifs en comportent
 * beaucoup, et les répéter noierait le peu d'information utile.
 */
export function rowToText(headers: SheetCell[], row: SheetCell[]): string {
  const parts: string[] = [];
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    const value = row[index];
    if (isBlank(header) || isBlank(value)) continue;
    parts.push(`${header.trim()} : ${value.trim()}`);
  }
  return parts.join(" ; ");
}

/**
 * Rend une feuille entière. Le nom de la feuille est répété en tête de chaque
 * ligne : le découpage en fragments peut séparer une ligne de son contexte,
 * et « Villages retenus » change tout au sens d'une ligne.
 */
export function sheetToText(sheet: SheetData): string {
  const lines: string[] = [];
  const label = sheet.name.trim();

  for (const row of sheet.rows) {
    const text = rowToText(sheet.headers, row);
    if (!text) continue;
    lines.push(label ? `[${label}] ${text}` : text);
  }

  return lines.join("\n");
}

/** Rend un classeur complet, feuille par feuille, en titrant chacune. */
export function workbookToText(sheets: SheetData[]): string {
  return sheets
    .map((sheet) => {
      const body = sheetToText(sheet);
      if (!body) return "";
      const title = sheet.name.trim();
      return title ? `# ${title}\n\n${body}` : body;
    })
    .filter((section) => section.length > 0)
    .join("\n\n");
}

/**
 * Retient la première ligne non vide comme en-tête. Les tableurs
 * administratifs commencent souvent par des lignes de titre ou des lignes
 * vides avant le vrai tableau.
 */
export function splitHeaderAndRows(rows: SheetCell[][]): {
  headers: SheetCell[];
  rows: SheetCell[][];
} {
  const firstFilled = rows.findIndex((row) => row.some((cell) => !isBlank(cell)));
  if (firstFilled === -1) return { headers: [], rows: [] };
  return { headers: rows[firstFilled], rows: rows.slice(firstFilled + 1) };
}
