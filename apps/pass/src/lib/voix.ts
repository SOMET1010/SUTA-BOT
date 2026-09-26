/**
 * Sonde du moteur de synthèse vocale du terminal.
 *
 * ── CE QUE CETTE SONDE EST, ET N'EST PAS ────────────────────────────────
 *
 * Elle interroge le moteur de synthèse du SYSTÈME, celui qu'une application
 * Android peut appeler (`TextToSpeech` côté natif, `speechSynthesis` depuis la
 * WebView). Ce n'est PAS le moteur de Chrome : les « voix naturelles Google »
 * du navigateur ne sont pas exposées aux applications tierces, et ne peuvent
 * donc pas être la bouche de PASS.
 *
 * Ce n'est pas non plus la synthèse de PASS. C'est une mesure, destinée à
 * trancher une question : le téléphone a-t-il déjà une voix française
 * utilisable HORS LIGNE, assez correcte pour servir de filet en V1 — ou
 * faut-il attendre la voix ivoirienne entraînée sur des enregistrements ?
 *
 * ── LE PIÈGE DE L'ÉTIQUETTE ──────────────────────────────────────────────
 *
 * `fr-CI` existe comme LOCALE dans Android, et une voix peut donc s'annoncer
 * « Français (Côte d'Ivoire) » sans qu'aucun modèle n'ait jamais entendu un
 * accent ivoirien. Un libellé n'est pas une voix. La sonde affiche donc le
 * code de langue brut de chaque voix, sans le traduire ni l'interpréter : à
 * l'oreille de juger, pas à l'étiquette.
 */

/** Ce qu'on retient d'une voix du terminal. Structure minimale, pour que les
 *  fonctions pures se testent sans DOM. */
export interface VoixTerminal {
  nom: string;
  langue: string;
  /** `true` = la voix vit sur l'appareil. C'est LE signal qui nous intéresse :
   *  une voix distante ne sert à rien à PASS, qui doit parler sans réseau. */
  horsLigne: boolean;
}

/**
 * Les six noms de l'épreuve.
 *
 * Ce ne sont pas des exemples au hasard : ce sont les toponymes sur lesquels
 * la reconnaissance d'Azure a échoué en production (« Nambékaha » entendu
 * « non pécar »). Les terminaisons -kro, -kaha, -dougou et l'apostrophe sont
 * les motifs les plus fréquents de la toponymie ivoirienne, et ce sont eux qui
 * mettent en défaut un modèle entraîné sur du français hexagonal — à l'oreille
 * comme à la bouche.
 */
export const TOPONYMES_EPREUVE = [
  "Korhogo",
  "Yamoussoukro",
  "Nambékaha",
  "N'Guessankro",
  "Bogodougou",
  "Sinématiali",
] as const;

/** Une phrase entière, parce qu'un nom isolé ne révèle pas la prosodie. */
export const PHRASE_EPREUVE = "J'appelle Awa à Nambékaha, près de Korhogo.";

/**
 * Le français sous toutes ses déclarations.
 *
 * On compare sur le PRÉFIXE, et on tolère le tiret bas : les moteurs Android
 * rendent parfois `fr_FR` là où la norme BCP-47 écrit `fr-FR`. Un filtre trop
 * strict masquerait des voix réellement présentes — et c'est exactement le
 * genre de détail qui fait conclure à tort qu'un téléphone n'a rien.
 */
export function estFrancaise(voix: VoixTerminal): boolean {
  const code = voix.langue.replace(/_/g, "-").toLowerCase();
  return code === "fr" || code.startsWith("fr-");
}

export function filtrerFrancaises(voix: readonly VoixTerminal[]): VoixTerminal[] {
  return voix.filter(estFrancaise);
}

export interface VerdictMoteur {
  total: number;
  francaises: number;
  /** Des voix françaises qui vivent sur l'appareil : le seul chiffre qui
   *  décide si PASS peut parler sans réseau. */
  francaisesHorsLigne: number;
  /** Les codes de langue française rencontrés, bruts et dédoublonnés. Si
   *  `fr-CI` y figure, c'est une étiquette à écouter, pas une preuve. */
  codesRencontres: string[];
  /** La phrase à afficher, sans jargon : c'est elle que lira Patrick. */
  conclusion: string;
}

export function verdictMoteur(voix: readonly VoixTerminal[]): VerdictMoteur {
  const francaises = filtrerFrancaises(voix);
  const horsLigne = francaises.filter((v) => v.horsLigne);
  const codes = [...new Set(francaises.map((v) => v.langue))].sort();

  let conclusion: string;
  if (voix.length === 0) {
    conclusion = "Aucune voix lue — le moteur n'a pas encore répondu, ou ce navigateur n'en expose aucune.";
  } else if (francaises.length === 0) {
    conclusion = "Aucune voix française sur ce terminal : PASS ne pourra pas parler avec le moteur du système.";
  } else if (horsLigne.length === 0) {
    conclusion =
      `${francaises.length} voix française(s), mais AUCUNE hors ligne : inutilisable pour PASS, ` +
      "qui doit parler sans réseau.";
  } else {
    conclusion =
      `${horsLigne.length} voix française(s) hors ligne disponible(s). ` +
      "Le filet existe — reste à juger l'accent à l'oreille.";
  }

  return {
    total: voix.length,
    francaises: francaises.length,
    francaisesHorsLigne: horsLigne.length,
    codesRencontres: codes,
    conclusion,
  };
}
