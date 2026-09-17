import { normaliser } from "@suta/pass";

/**
 * L'appariement d'un libellé prononcé avec ce que le téléphone contient.
 *
 * Ce module est la réponse à deux consignes de sûreté du lot Android :
 *
 *   « un homonyme dans les contacts ne doit jamais être choisi automatiquement »
 *   « pas de logique métier dupliquée en Kotlin »
 *
 * Les deux se tiennent. Si Kotlin choisissait le contact, la règle des
 * homonymes vivrait en Kotlin — donc hors de portée des tests, et dupliquée le
 * jour où iOS arriverait. Le partage est donc strict :
 *
 *   Kotlin ÉNUMÈRE (les applications installées, les contacts) — données brutes.
 *   TypeScript APPARIE et DÉCIDE — ici, avec la normalisation de `@suta/pass`.
 *   Kotlin EXÉCUTE sur une cible déjà désignée (un paquet, un numéro).
 *
 * Aucune règle ne descend en Kotlin, et rien de ce qui décide n'échappe aux
 * tests.
 */

export interface Candidat {
  /** Ce que la personne voit et prononce : « Awa Koné », « WhatsApp ». */
  libelle: string;
  /** Ce que la plateforme exécute : un numéro, un nom de paquet. */
  valeur: string;
}

export type Correspondance =
  | { statut: "unique"; candidat: Candidat }
  | { statut: "aucune" }
  | { statut: "ambigue"; candidats: Candidat[] };

/** Les trois passes, de la plus stricte à la plus tolérante. */
const PASSES: ((cible: string, libelle: string) => boolean)[] = [
  (cible, libelle) => libelle === cible,
  (cible, libelle) => libelle.startsWith(cible),
  (cible, libelle) => libelle.includes(cible),
];

/**
 * Apparie une cible prononcée avec une liste de candidats.
 *
 * DEUX RÈGLES, et elles ne se négocient pas :
 *
 * 1. **On ne choisit jamais entre deux valeurs différentes.** Deux contacts
 *    « Awa » avec deux numéros distincts rendent `ambigue`, jamais le premier
 *    des deux. Appeler le mauvais numéro n'est pas rattrapable.
 * 2. **Une passe plus tolérante n'est tentée que si la précédente n'a rien
 *    donné.** Une correspondance exacte n'est jamais noyée par des
 *    correspondances partielles : si « Awa » existe exactement, « Awa Koné »
 *    et « Mariawa » ne viennent pas la concurrencer.
 *
 * Les doublons stricts sont fusionnés d'abord : deux fiches pour la même
 * personne avec le MÊME numéro ne sont pas une ambiguïté, puisque les deux
 * chemins mènent au même appel.
 */
export function apparier(cible: string, candidats: readonly Candidat[]): Correspondance {
  const recherche = normaliser(cible);
  if (!recherche) return { statut: "aucune" };

  for (const correspond of PASSES) {
    const retenus = candidats.filter((c) => correspond(recherche, normaliser(c.libelle)));
    if (retenus.length === 0) continue;

    const parValeur = new Map<string, Candidat>();
    for (const candidat of retenus) {
      if (!parValeur.has(candidat.valeur)) parValeur.set(candidat.valeur, candidat);
    }
    const distincts = [...parValeur.values()];
    if (distincts.length === 1) return { statut: "unique", candidat: distincts[0] };
    return { statut: "ambigue", candidats: distincts };
  }
  return { statut: "aucune" };
}
