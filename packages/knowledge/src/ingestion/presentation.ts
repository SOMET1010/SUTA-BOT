/**
 * Lecture des présentations PowerPoint.
 *
 * Une grande partie de la matière que produit une direction tient dans des
 * decks : stratégie, scénarios, séances de conseil d'administration. Le texte
 * y est éclaté en « runs » (`<a:t>`) à l'intérieur de paragraphes (`<a:p>`),
 * chaque changement de police ou de couleur ouvrant un nouveau run. Les
 * concaténer bêtement produirait « L'ANSUT met en œuvre | un | programme » ;
 * les recoller par paragraphe rend la phrase.
 *
 * Les notes de l'orateur comptent autant que les diapositives, souvent plus :
 * la diapositive porte le chiffre, la note porte ce qu'il veut dire.
 *
 * Ce module ne connaît ni le système de fichiers ni le format ZIP : il reçoit
 * du XML déjà extrait. C'est ce qui permet de le tester sans fixture binaire.
 */

/** Rend les entités XML que l'on rencontre dans du texte PowerPoint. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    // En dernier : sans quoi `&amp;lt;` deviendrait `<`.
    .replace(/&amp;/g, "&");
}

/**
 * Texte d'une diapositive (ou d'une note), un paragraphe par ligne.
 *
 * Les sauts de ligne explicites (`<a:br/>`) sont conservés, les runs d'un même
 * paragraphe recollés sans séparateur — c'est ainsi que PowerPoint les a
 * découpés, et les remettre bout à bout restitue la phrase d'origine.
 */
export function slideTextFromXml(xml: string): string {
  const paragraphs: string[] = [];

  for (const [, body] of xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)) {
    const runs = [...body.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((match) =>
      decodeEntities(match[1]),
    );
    if (runs.length === 0) continue;
    const line = runs.join("").replace(/\s+/g, " ").trim();
    if (line) paragraphs.push(line);
  }

  return paragraphs.join("\n");
}

/**
 * Ordonne `slide2.xml`, `slide10.xml`… par numéro et non par ordre
 * alphabétique, qui placerait la diapositive 10 avant la diapositive 2.
 */
export function orderSlideNames(names: string[]): string[] {
  const rank = (name: string): number => {
    const found = /(\d+)\.xml$/.exec(name);
    return found ? Number(found[1]) : Number.MAX_SAFE_INTEGER;
  };
  return [...names].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Retrouve la note attachée à une diapositive.
 *
 * La numérotation des notes ne suit pas celle des diapositives : `slide7`
 * peut pointer vers `notesSlide3`. Le lien est porté par le fichier de
 * relations de la diapositive, seule source fiable.
 */
export function notesTargetFromRels(relsXml: string): string | null {
  for (const [, target] of relsXml.matchAll(/Target="([^"]+)"/g)) {
    if (target.includes("notesSlide")) {
      // Les cibles sont relatives à `ppt/slides/` : « ../notesSlides/x.xml ».
      return `ppt/notesSlides/${target.split("/").pop()}`;
    }
  }
  return null;
}

export interface SlideContent {
  /** Rang de la diapositive dans le déroulé, à partir de 1. */
  index: number;
  /** Texte de la diapositive elle-même. */
  body: string;
  /** Notes de l'orateur, quand la diapositive en porte. */
  notes?: string;
}

/**
 * Assemble une présentation en un texte suivi.
 *
 * Chaque diapositive est annoncée par son rang : le découpage en fragments
 * qui suit tranchera quelque part, et un fragment qui commence par
 * « Diapositive 12 » reste situable, là où un fragment anonyme ne l'est pas.
 */
export function presentationToText(slides: SlideContent[]): string {
  const blocks: string[] = [];

  for (const slide of slides) {
    const parts: string[] = [];
    if (slide.body) parts.push(slide.body);
    if (slide.notes) parts.push(`Notes de présentation : ${slide.notes}`);
    if (parts.length === 0) continue;
    blocks.push(`[Diapositive ${slide.index}]\n${parts.join("\n")}`);
  }

  return blocks.join("\n\n");
}
