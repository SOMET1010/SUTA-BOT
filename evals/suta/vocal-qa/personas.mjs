/**
 * Personas de l'AGENT-CITOYEN (campagne conversationnelle — campagne.mjs).
 *
 * Un persona est un citoyen simulé : un script de répliques (WAV figés de
 * evals/suta/audio/campagne/, générés par gen_repliques.py) et des réflexes
 * de conversation. Le déroulé est DYNAMIQUE : à chaque tour, l'agent lit ce
 * que SUTA vient de dire et choisit sa réplique —
 *
 *   1. SUTA demande la localité  → réplique `localite` (une fois) ;
 *   2. SUTA offre d'en dire plus → réplique `relance` (crédits limités,
 *      pour garantir que la conversation avance) ;
 *   3. sinon                     → la prochaine réplique du script.
 *
 * Une réplique `interrompt: true` ne laisse pas SUTA finir : elle part
 * pendant qu'il parle (mesure du barge-in au milieu d'un vrai dialogue).
 */

/** SUTA demande où habite la personne. */
export const DEMANDE_LOCALITE_RE =
  /nom de (votre|ton) (village|localité|commune)|quelle (est votre |est ta )?localité|quel village|pr[ée]cisez votre localit|o[uù] (habitez|vivez|êtes)-vous|donnez[- ]moi son nom/i;

/** SUTA propose de continuer. */
export const OFFRE_SUITE_RE =
  /en dire plus|en savoir plus|si vous voulez|je peux continuer|voulez-vous que je|souhaitez-vous/i;

export const PERSONAS = {
  /** L'habitant d'un village : cas d'usage cœur (couverture + accès). */
  habitant: {
    description: "Habitant de village — couverture, localité, accès internet",
    script: ["bonjour-village.wav", "internet-maison.wav", "merci.wav"],
    localite: "localite-tieme.wav",
    relance: "dis-moi-plus.wav",
    relances: 1,
  },
  /** Le curieux : questions générales et relances minimales (« dis plus »,
   * « encore ») — le scénario exact de la perte de fil du 31/08. */
  curieux: {
    description: "Curieux — service universel, RNHD, relances en chaîne",
    script: ["service-universel.wav", "dis-moi-plus.wav", "encore.wav", "rnhd.wav", "merci.wav"],
    localite: "localite-tieme.wav",
    relance: "dis-moi-plus.wav",
    relances: 1,
  },
  /** Le pressé : interrompt, demande des démarches, sort du périmètre —
   * les garde-fous de la recette v3 (C09/C10/C14, F08) en conversation. */
  presse: {
    description: "Pressé — interruption, rendez-vous, conseiller, hors périmètre",
    script: [
      "bonjour-equiper.wav",
      "interruption-former.wav",
      "rendez-vous.wav",
      "conseiller.wav",
      "capitale-france.wav",
      "au-revoir.wav",
    ],
    localite: "localite-tieme.wav",
    relance: null,
    relances: 0,
    interruptions: ["interruption-former.wav"],
  },
};
