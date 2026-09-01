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
  /(?:j'habite|je vis|je suis)\s+(?:à|a|au|aux)?\s*([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ' -]{2,35})/i,
  /(?:ma localit[eé] est|mon village est|mon village s'appelle)\s+([A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÿ' -]{2,35})/i,
];

/* Contre-audit du 01/09 : « Mon village est connecté ? » mémorisait la
 * localité « connecté » — et ce faux nom, jamais invalidé, polluait ensuite
 * chaque recherche de la session. « mon village est X » et « je suis X »
 * capturent aussi des ÉTATS : tout mot d'état du domaine en tête de capture
 * disqualifie la prise. */
const ETATS_NON_LOCALITE =
  /^(?:(?:il|elle|on|ne|pas|deja|encore|bien|tres|dans|pres|loin)\b|connect|couvert|reli|raccord|equip|desserv|isol|enclav|situ)/i;

function capturerLocalite(utterance: string): string | undefined {
  for (const pattern of LOCALITY_PATTERNS) {
    const brut = utterance.match(pattern)?.[1]?.trim().replace(/[?.!,;:]+$/, "");
    if (!brut) continue;
    const sansAccents = brut.normalize("NFD").replace(/\p{M}/gu, "");
    if (ETATS_NON_LOCALITE.test(sansAccents)) return undefined;
    // Un nom de localité tient en trois mots ; au-delà, c'est une phrase.
    const mots = brut.split(/\s+/);
    if (mots.length > 3) return undefined;
    return brut;
  }
  return undefined;
}

/** Mémoire légère de session. Elle ne persiste rien hors de la conversation. */
export function updateSessionContext(previous: SutaSessionContext, utterance: string): SutaSessionContext {
  const next = { ...previous, lastTopics: [...previous.lastTopics] };
  const lower = utterance.toLowerCase();
  const localite = capturerLocalite(utterance);
  if (localite) next.locality = localite;
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
