export interface TextChunk {
  /** Position (0-indexée) du fragment dans le document. */
  index: number;
  content: string;
}

export interface ChunkTextOptions {
  /** Taille maximale d'un fragment, en caractères. */
  maxChars?: number;
  /** Nombre de caractères repris du fragment précédent, pour préserver le contexte. */
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 1000;
const DEFAULT_OVERLAP_CHARS = 150;

/**
 * Découpe un texte nettoyé en fragments (cahier des charges, section 15).
 * Respecte les paragraphes autant que possible : un paragraphe qui dépasse
 * `maxChars` à lui seul est découpé plus finement par phrase.
 */
export function chunkText(text: string, options: ChunkTextOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const segments: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      segments.push(paragraph);
      continue;
    }
    // Paragraphe trop long : découpage par phrase.
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let current = "";
    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 > maxChars && current.length > 0) {
        segments.push(current.trim());
        current = "";
      }
      current += (current ? " " : "") + sentence;
    }
    if (current.trim()) segments.push(current.trim());
  }

  const chunks: string[] = [];
  let current = "";
  for (const segment of segments) {
    const candidate = current ? `${current}\n\n${segment}` : segment;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      const overlap = overlapChars > 0 ? current.slice(-overlapChars) : "";
      current = overlap ? `${overlap}\n\n${segment}` : segment;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current);

  return chunks.map((content, index) => ({ index, content: content.trim() }));
}
