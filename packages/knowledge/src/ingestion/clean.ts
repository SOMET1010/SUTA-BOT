/**
 * Nettoyage minimal du texte extrait avant découpage (cahier des charges,
 * section 15 : Extraction → Nettoyage → Découpage).
 */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}
