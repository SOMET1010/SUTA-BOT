import type { LanguePass } from "@suta/pass";

/**
 * Les commandes d'exemple, par langue.
 *
 * Le français est acquis : ces formes viennent des motifs éprouvés du lot 1.
 *
 * 🔵 LE DIOULA NE L'EST PAS. Chaque exemple dioula ci-dessous est une
 * PROPOSITION de l'agent de développement, qui n'est pas dioulaphone. Ils sont
 * composés uniquement des mots déjà présents dans les motifs de
 * `packages/pass/src/intentions.ts` — aucun mot nouveau n'est inventé ici — et
 * chacun couvre une intention, pour qu'un locuteur natif puisse les valider ou
 * les corriger un par un, sur un téléphone réel.
 *
 * L'ordre des mots suit l'hypothèse SOV (« Awa wele » : la cible PRÉCÈDE le
 * verbe, à l'inverse du français). C'est précisément ce qu'il faut faire
 * confirmer : si un locuteur dit spontanément « wele Awa », c'est l'extraction
 * du lot 1 qui est à revoir, pas l'exemple.
 *
 * Ce qui MANQUE sciemment : la forme dioula de « couper le son », jamais
 * devinée. Aucun exemple ne la propose donc.
 */
export const EXEMPLES: Record<LanguePass, readonly string[]> = {
  fr: [
    "appelle Awa",
    "ouvre WhatsApp",
    "monte le son",
    "mets le volume à 30",
    "prends une photo",
    "aide-moi",
    "quel temps fait-il",
  ],
  dyu: [
    "Awa wele",
    "WhatsApp yele",
    "mankan bonya",
    "mankan dɔgɔya",
    "foto ta",
    "n dɛmɛ",
    "segin kokura",
    "dabila",
  ],
};

export const NOM_LANGUE: Record<LanguePass, string> = { fr: "français", dyu: "dioula" };
