import type { ActionPass, ReglerVolume } from "./actions";
import type { CodeEchec, ResultatAction } from "./bridge";
import type { LanguePass } from "./langue";

/**
 * Ce que PASS dit : avant d'agir, pendant, et quand ça échoue.
 *
 * ── SUR L'ABSENCE DE PHRASES DIOULA ──────────────────────────────────────
 *
 * Ce module ne contient AUCUNE phrase en dioula, et c'est délibéré.
 *
 * Deux raisons, dans cet ordre. D'abord, il n'existe à ce jour aucune voix
 * dioula utilisable : l'audit linguistique (SUTA-LANGUES) a établi que le seul
 * composant vocal permissif de toute la cartographie est un prototype baoulé
 * de 2022, sans corpus publié. PASS ne saurait pas PRONONCER une phrase dioula
 * même si elle était écrite ici. Ensuite, et c'est la raison qui vaudrait même
 * si une voix existait : l'agent qui écrit ce code n'est pas dioulaphone, et la
 * méthode du projet interdit de faire passer une supposition pour un acquis.
 *
 * Le repli vers le français est donc EXPLICITE et observable : `traduite` vaut
 * `false`, et un test le vérifie. Le jour où un locuteur natif fournit les
 * formulations, elles entrent dans `PHRASES.dyu` et `traduite` devient vrai —
 * sans qu'une seule ligne d'appelant ne change.
 */

export interface PhrasePass {
  texte: string;
  /** La langue réellement rendue — peut différer de celle demandée. */
  langue: LanguePass;
  /** Faux quand la phrase est un repli sur le français faute de traduction. */
  traduite: boolean;
}

/**
 * Quelles actions demandent l'accord de la personne avant d'être exécutées ?
 *
 * UNE SEULE : l'appel. Il engage de l'argent, il sonne chez quelqu'un d'autre,
 * et une erreur de reconnaissance sur un nom est irrattrapable une fois la
 * ligne ouverte. Ouvrir une application, régler le volume et prendre une photo
 * sont immédiatement réversibles : demander confirmation les rendrait pénibles
 * sans rien protéger.
 *
 * C'est un arbitrage produit, pas une contrainte technique : il se change ici,
 * en une ligne, et les tests suivent.
 */
export function exigeConfirmation(action: ActionPass): boolean {
  return action.nom === "appeler_contact";
}

const PHRASES = {
  fr: {
    confirmer_appel: (nom: string) => `Voulez-vous que j'appelle ${nom} ?`,
    annonce_appel: (nom: string) => `J'appelle ${nom}.`,
    annonce_ouvrir: (app: string) => `J'ouvre ${app}.`,
    annonce_volume_monter: "Je monte le son.",
    annonce_volume_baisser: "Je baisse le son.",
    annonce_volume_couper: "Je coupe le son.",
    annonce_volume_definir: (niveau: number) => `Je mets le son à ${niveau}.`,
    annonce_photo: "Je prends la photo.",
    aide:
      "Je peux appeler quelqu'un de votre répertoire, ouvrir une application, " +
      "régler le son et prendre une photo. Dites-moi ce que vous voulez faire.",
    arret: "J'arrête.",
    refus: "Je ne sais pas encore faire cela.",
    echec: {
      permission_refusee: "Je n'ai pas l'autorisation de faire cela sur ce téléphone.",
      introuvable: "Je ne trouve pas cela sur ce téléphone.",
      non_supporte: "Ce téléphone ne sait pas faire cela.",
      annule_par_utilisateur: "C'est annulé.",
      erreur_interne: "Cela n'a pas marché. Voulez-vous réessayer ?",
    } satisfies Record<CodeEchec, string>,
  },
  /** 🔵 À REMPLIR PAR UN LOCUTEUR NATIF. Vide n'est pas un oubli (cf. en-tête). */
  dyu: {},
} as const;

type ClefPhrase = keyof (typeof PHRASES)["fr"];

function rendre(texte: string, langue: LanguePass, clef: ClefPhrase): PhrasePass {
  const traduite = langue === "fr" || clef in PHRASES.dyu;
  return { texte, langue: traduite ? langue : "fr", traduite };
}

/** La question posée AVANT d'agir, pour les actions qui l'exigent. */
export function demandeConfirmation(action: ActionPass, langue: LanguePass = "fr"): PhrasePass | null {
  if (!exigeConfirmation(action)) return null;
  if (action.nom !== "appeler_contact") return null;
  return rendre(PHRASES.fr.confirmer_appel(action.entree.nom), langue, "confirmer_appel");
}

/** Le volume a quatre sens, isolés ici pour garder `annonce` plat et lisible. */
function annonceVolume(entree: ReglerVolume, langue: LanguePass): PhrasePass {
  const fr = PHRASES.fr;
  switch (entree.sens) {
    case "monter":
      return rendre(fr.annonce_volume_monter, langue, "annonce_volume_monter");
    case "baisser":
      return rendre(fr.annonce_volume_baisser, langue, "annonce_volume_baisser");
    case "couper":
      return rendre(fr.annonce_volume_couper, langue, "annonce_volume_couper");
    case "definir":
      return rendre(fr.annonce_volume_definir(entree.niveau ?? 0), langue, "annonce_volume_definir");
  }
}

/** Ce que PASS dit au moment d'agir. */
export function annonce(action: ActionPass, langue: LanguePass = "fr"): PhrasePass {
  const fr = PHRASES.fr;
  switch (action.nom) {
    case "appeler_contact":
      return rendre(fr.annonce_appel(action.entree.nom), langue, "annonce_appel");
    case "ouvrir_application":
      return rendre(fr.annonce_ouvrir(action.entree.application), langue, "annonce_ouvrir");
    case "regler_volume":
      return annonceVolume(action.entree, langue);
    case "prendre_photo":
      return rendre(fr.annonce_photo, langue, "annonce_photo");
    case "assistance":
      switch (action.entree.geste) {
        case "aide":
          return rendre(fr.aide, langue, "aide");
        case "arreter":
          return rendre(fr.arret, langue, "arret");
        case "repeter":
          // `repeter` n'a pas de phrase propre : c'est la dernière réponse qui
          // est redite, et l'appelant la détient — pas ce module.
          return rendre("", langue, "arret");
      }
  }
}

/** Ce que PASS dit quand le pont natif a répondu. */
export function messageResultat(resultat: ResultatAction, langue: LanguePass = "fr"): PhrasePass {
  if (resultat.ok) return rendre(resultat.message, langue, "arret");
  const code: CodeEchec = resultat.code ?? "erreur_interne";
  // Le pont peut proposer une phrase plus précise ; sinon on retombe sur le
  // message générique du code. Jamais de `detail` technique énoncé.
  const texte = resultat.message.trim() || PHRASES.fr.echec[code];
  return rendre(texte, langue, "arret");
}

/** Ce que PASS dit quand la commande n'est pas de son ressort. */
export function messageRefus(langue: LanguePass = "fr"): PhrasePass {
  return rendre(PHRASES.fr.refus, langue, "refus");
}
