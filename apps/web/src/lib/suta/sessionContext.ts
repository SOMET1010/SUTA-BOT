export interface SutaSessionContext {
  locality?: string;
  person?: string;
  goal?: string;
  device?: string;
  audience?: string;
  lastTopics: string[];
}

export const EMPTY_SUTA_CONTEXT: SutaSessionContext = { lastTopics: [] };

/* Un « à » isolé capturait n'importe quel mot capitalisé après la lettre « a »
 * (« on a WhatsApp » → localité WhatsApp) : la préposition n'est acceptée
 * qu'accolée à un verbe d'habitation. */
const LOCALITY_PATTERNS = [
  /(?:j'habite|je vis|je suis)\s+(?:à|a|au|aux)?\s*([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ' -]{2,35})/,
  /(?:ma localit[eé] est|mon village est|mon village s'appelle)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ' -]{2,35})/,
];

/** Mémoire légère de session. Elle ne persiste rien hors de la conversation. */
export function updateSessionContext(previous: SutaSessionContext, utterance: string): SutaSessionContext {
  const next = { ...previous, lastTopics: [...previous.lastTopics] };
  const lower = utterance.toLowerCase();
  for (const pattern of LOCALITY_PATTERNS) {
    const match = utterance.match(pattern);
    if (match?.[1]) { next.locality = match[1].trim().replace(/[?.!,;:]+$/, ""); break; }
  }
  if (/ma mere|ma mère/.test(lower)) next.person = "sa mère";
  else if (/mon pere|mon père/.test(lower)) next.person = "son père";
  else if (/mon enfant|ma fille|mon fils/.test(lower)) next.person = "son enfant";
  else if (/pour moi|je veux|j'aimerais|je voudrais/.test(lower)) next.person = "elle-même ou lui-même";

  if (/smartphone|telephone|téléphone/.test(lower)) next.device = "smartphone";
  else if (/ordinateur|pc|laptop/.test(lower)) next.device = "ordinateur";
  else if (/tablette/.test(lower)) next.device = "tablette";

  const topic = /connect|reseau|réseau|internet|4g|5g|fibre/.test(lower) ? "connecter" : /equip|équip|smartphone|ordinateur|tablette/.test(lower) ? "equiper" : /form|apprendre|competence|compétence/.test(lower) ? "former" : undefined;
  if (topic && next.lastTopics[next.lastTopics.length - 1] !== topic) next.lastTopics = [...next.lastTopics.slice(-3), topic];
  return next;
}

export function contextForModel(context: SutaSessionContext): string {
  const facts = [
    context.locality && `Localité déjà donnée : ${context.locality}`,
    context.person && `La demande concerne : ${context.person}`,
    context.device && `Équipement mentionné : ${context.device}`,
    context.goal && `Objectif : ${context.goal}`,
    context.lastTopics.length && `Sujets récents : ${context.lastTopics.join(", ")}`,
  ].filter(Boolean);
  return facts.length ? `\n\nCONTEXTE DE SESSION À NE PAS REDEMANDER :\n- ${facts.join("\n- ")}` : "";
}
