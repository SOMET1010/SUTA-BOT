export interface SutaSessionContext {
  locality?: string;
  person?: string;
  goal?: string;
  device?: string;
  audience?: string;
  lastTopics: string[];
}

export const EMPTY_SUTA_CONTEXT: SutaSessionContext = { lastTopics: [] };

const LOCALITY_PATTERNS = [
  /(?:je suis|j'habite|je vis|chez moi|ma localite est|mon village est|a|à)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ' -]{2,35})/,
];

/** Memoire legere de session. Elle ne persiste rien hors de la conversation. */
export function updateSessionContext(previous: SutaSessionContext, utterance: string): SutaSessionContext {
  const next = { ...previous, lastTopics: [...previous.lastTopics] };
  const lower = utterance.toLowerCase();
  for (const pattern of LOCALITY_PATTERNS) {
    const match = utterance.match(pattern);
    if (match?.[1]) { next.locality = match[1].trim().replace(/[?.!,;:]+$/, ""); break; }
  }
  if (/ma mere|ma mère/.test(lower)) next.person = "sa mere";
  else if (/mon pere|mon père/.test(lower)) next.person = "son pere";
  else if (/mon enfant|ma fille|mon fils/.test(lower)) next.person = "son enfant";
  else if (/pour moi|je veux|j'aimerais|je voudrais/.test(lower)) next.person = "lui-meme";

  if (/smartphone|telephone|téléphone/.test(lower)) next.device = "smartphone";
  else if (/ordinateur|pc|laptop/.test(lower)) next.device = "ordinateur";
  else if (/tablette/.test(lower)) next.device = "tablette";

  const topic = /connect|reseau|réseau|internet|4g|5g|fibre/.test(lower) ? "connecter" : /equip|équip|smartphone|ordinateur|tablette/.test(lower) ? "equiper" : /form|apprendre|competence|compétence/.test(lower) ? "former" : undefined;
  if (topic && next.lastTopics[next.lastTopics.length - 1] !== topic) next.lastTopics = [...next.lastTopics.slice(-3), topic];
  return next;
}

export function contextForModel(context: SutaSessionContext): string {
  const facts = [
    context.locality && `Localite deja donnee : ${context.locality}`,
    context.person && `La demande concerne : ${context.person}`,
    context.device && `Equipement mentionne : ${context.device}`,
    context.goal && `Objectif : ${context.goal}`,
    context.lastTopics.length && `Sujets recents : ${context.lastTopics.join(", ")}`,
  ].filter(Boolean);
  return facts.length ? `\n\nCONTEXTE DE SESSION A NE PAS REDEMANDER :\n- ${facts.join("\n- ")}` : "";
}
