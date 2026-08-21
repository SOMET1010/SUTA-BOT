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
  /** Ligne d'en-tête retenue, éventuellement fusionnée sur deux niveaux. */
  headers: SheetCell[];
  rows: SheetCell[][];
}

function isBlank(cell: SheetCell | undefined): boolean {
  return cell === undefined || cell.trim().length === 0;
}

function filledCount(row: SheetCell[]): number {
  return row.reduce((total, cell) => (isBlank(cell) ? total : total + 1), 0);
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

/** Nombre de lignes examinées à la recherche de l'en-tête. */
const HEADER_SCAN_ROWS = 12;

/**
 * Étale une ligne de regroupement sur les colonnes qu'elle couvre.
 *
 * Un en-tête de groupe est une cellule fusionnée : « AU LANCEMENT » n'est
 * écrit qu'une fois, puis suivi de vides jusqu'au groupe suivant. Recopier la
 * valeur sur ces vides restitue la portée réelle du groupe.
 */
function spreadGroups(row: SheetCell[]): SheetCell[] {
  const spread: SheetCell[] = [];
  let current = "";
  for (const cell of row) {
    if (!isBlank(cell)) current = cell.trim();
    spread.push(current);
  }
  return spread;
}

/**
 * Vrai si la ligne présente des trous *entre* ses valeurs — la signature
 * d'une ligne de cellules fusionnées, donc d'un en-tête de regroupement.
 * Une ligne de données peut avoir des trous en fin de ligne, rarement au
 * milieu de colonnes par ailleurs renseignées.
 */
function looksLikeGroupRow(row: SheetCell[]): boolean {
  const first = row.findIndex((cell) => !isBlank(cell));
  if (first === -1) return false;
  let last = row.length - 1;
  while (last > first && isBlank(row[last])) last -= 1;
  if (last - first < 2) return false;
  for (let index = first + 1; index < last; index += 1) {
    if (isBlank(row[index])) return true;
  }
  return false;
}

/**
 * Sépare l'en-tête des données.
 *
 * On ne peut pas se contenter de la première ligne non vide : les tableurs
 * transmis par les directions s'ouvrent presque toujours sur un titre, un
 * logo ou une ligne de date. La ligne d'en-tête est celle qui renseigne le
 * plus de colonnes — un titre en occupe une, un en-tête les occupe toutes.
 *
 * Ces tableurs superposent en outre fréquemment deux niveaux : une ligne de
 * regroupement (« AU LANCEMENT », « 2030 ») au-dessus d'une ligne de colonnes
 * (« # de paires », « Structure tarifaire »). Prise seule, la seconde perd ce
 * qui la distingue : trois colonnes « # de paires » deviennent
 * indiscernables. Les deux niveaux sont donc fusionnés en
 * « AU LANCEMENT — # de paires ».
 */
export function splitHeaderAndRows(rows: SheetCell[][]): {
  headers: SheetCell[];
  rows: SheetCell[][];
} {
  const scanned = rows.slice(0, HEADER_SCAN_ROWS);

  const widest = Math.max(0, ...scanned.map(filledCount));
  if (widest === 0) return { headers: [], rows: [] };

  // Pas la ligne la plus large, mais la première qui approche la plus large :
  // un en-tête laisse parfois une colonne sans titre là où les données en ont
  // une, et la ligne suivante le dépasserait alors d'une cellule.
  const headerIndex = scanned.findIndex((row) => filledCount(row) >= widest * 0.8);

  let headers = rows[headerIndex];

  // Niveau supérieur : la ligne renseignée la plus proche au-dessus, si elle
  // a l'allure d'un regroupement.
  for (let above = headerIndex - 1; above >= 0; above -= 1) {
    if (filledCount(rows[above]) === 0) continue;
    if (looksLikeGroupRow(rows[above])) {
      const groups = spreadGroups(rows[above]);
      headers = headers.map((cell, index) => {
        const group = groups[index];
        if (isBlank(group)) return cell;
        if (isBlank(cell)) return group;
        return group.trim() === cell.trim() ? cell : `${group} — ${cell.trim()}`;
      });
    }
    break;
  }

  return { headers, rows: rows.slice(headerIndex + 1) };
}
