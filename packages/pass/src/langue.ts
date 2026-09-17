/**
 * Normalisation du texte avant routage — la partie la moins spectaculaire du
 * lot 1, et celle qui décide si le dioula est reconnu ou non.
 *
 * Le piège : `sansAccents` tel qu'il est écrit dans `intentions.ts` (côté
 * citoyen) décompose en NFD puis retire les marques combinantes. Cela suffit
 * pour le français, mais PAS pour le dioula : `ɛ` (U+025B), `ɔ` (U+0254),
 * `ɲ` (U+0272) et `ŋ` (U+014B) sont des LETTRES à part entière, pas des
 * lettres accentuées. NFD ne les décompose pas et `\p{M}` ne les retire pas.
 * Sans la table ci-dessous, « yɛlɛ » ne rencontrerait jamais le motif `yele`.
 *
 * Les tons notés à la française (à, á, è, é…) restent traités par NFD, ce qui
 * est correct : l'orthographe du dioula les emploie de façon inconstante et
 * nous ne voulons pas qu'un ton manquant fasse échouer une commande.
 */

/** Lettres propres aux orthographes mandingues, et leur équivalent ASCII.
 * Les ligatures françaises `œ` et `æ` sont traitées ici pour la même raison :
 * NFD ne les décompose pas non plus, et sans elles « sœur » deviendrait
 * « s ur » — un contact qu'on ne retrouverait jamais dans le carnet. */
const LETTRES_MANDINGUES: Record<string, string> = {
  "ɛ": "e",
  "ɔ": "o",
  "ɲ": "ny",
  "ŋ": "n",
  "Ɛ": "e",
  "Ɔ": "o",
  "Ɲ": "ny",
  "Ŋ": "n",
  "œ": "oe",
  "Œ": "oe",
  "æ": "ae",
  "Æ": "ae",
};

/**
 * Texte prêt à être confronté aux motifs : minuscules, sans marques de ton,
 * lettres mandingues ramenées à l'ASCII, ponctuation réduite à des espaces.
 *
 * La ponctuation devient un espace (et non rien) pour que les frontières de
 * mot `\b` restent vraies : « appelle-moi Awa » doit exposer `moi` et `awa`
 * comme deux mots, pas produire `appellemoi`.
 */
export function normaliser(texte: string): string {
  const mandingueRamene = texte.replace(/[ɛɔɲŋƐƆƝŊœŒæÆ]/g, (lettre) => LETTRES_MANDINGUES[lettre] ?? lettre);
  return mandingueRamene
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Les langues que le routeur PASS sait confronter au texte.
 *
 * V1 (arbitrage du 17/09) : `fr` hors ligne, `dyu` en ligne. Le baoulé (`bci`)
 * est au périmètre produit V1 mais n'a PAS de motifs ici — il n'entre qu'avec
 * sa propre collecte, et déclarer un jeu de motifs vide serait pire que de ne
 * rien déclarer.
 */
export type LanguePass = "fr" | "dyu";

/**
 * Les jeux de motifs à appliquer pour une langue donnée.
 *
 * Le français est TOUJOURS appliqué, même en session dioula. Ce n'est pas une
 * facilité : l'audit linguistique a établi que l'alternance codique est la
 * norme et non l'exception dans les usages réels (les insertions françaises de
 * kunkado sont balisées dans le corpus lui-même). Une commerçante qui parle
 * dioula dira « prends une photo » aussi souvent que sa forme dioula.
 *
 * L'inverse n'est PAS vrai : en session française, les motifs dioula ne sont
 * pas appliqués. Plusieurs mots dioula utiles sont très courts (`ja`, `kan`,
 * `ta`) et provoqueraient des collisions dans un texte français.
 */
export function jeuxDeMotifs(langue: LanguePass): readonly ("fr" | "dyu")[] {
  return langue === "dyu" ? (["fr", "dyu"] as const) : (["fr"] as const);
}
