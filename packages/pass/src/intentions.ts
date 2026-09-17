import { jeuxDeMotifs, normaliser, type LanguePass } from "./langue";

/**
 * SUTA PASS — le routage d'intention du téléphone.
 *
 * Ce module reprend le PATRON d'`apps/web/src/lib/realtime/intentions.ts`
 * (instance citoyenne), jamais son contenu : un module unique où l'intention
 * se décide, délibérément déterministe — aucun modèle dans la boucle, chaque
 * décision reproductible et testable au banc, commande par commande.
 *
 * Deux raisons rendent ce déterminisme non négociable ici, là où il était un
 * confort côté citoyen :
 *
 * 1. HORS LIGNE. Le mode PASS doit décider sans réseau. Un appel de modèle
 *    est par construction impossible dans ce cas.
 * 2. LE TÉLÉPHONE AGIT. Une intention citoyenne mal classée rend une mauvaise
 *    réponse ; une intention PASS mal classée passe un appel, ouvre une
 *    application ou déclenche l'appareil photo. Le coût d'une erreur n'est
 *    pas du même ordre.
 *
 * D'où la règle de sûreté qui gouverne tout le fichier :
 *
 *    LE DÉFAUT N'AGIT JAMAIS.
 *
 * Toute commande non reconnue tombe sur `hors_perimetre`, et PASS ne fait
 * rien. Il n'y a délibérément AUCUNE liste de marqueurs « hors domaine » ici :
 * le contre-audit du 01/09 a montré qu'un couperet à base de mots-clés est un
 * « couperet aveugle ». Quand le défaut refuse, le couperet devient inutile.
 */

/** Les cinq intentions de la première tranche, plus le refus par défaut. */
export type IntentionPass =
  | "appeler_contact"
  | "ouvrir_application"
  | "regler_volume"
  | "prendre_photo"
  | "assistance" // aide / répète / stop — la seule qui ne touche pas au matériel
  | "hors_perimetre";

// ---------------------------------------------------------------------------
// Motifs français
// ---------------------------------------------------------------------------

/** Verbes d'appel. `telephone` exige son complément (`telephone a ...`) :
 * sans cela, « règle le volume de mon téléphone » partirait en appel. */
const FR_APPELER =
  /\b(appelle|appeler|appelles|rappelle|rappeler|joins|joindre)\b|\btelephone (a|au|aux)\b|\btelephoner (a|au|aux)\b|\bpasse un appel\b|\bcompose le numero\b/;

const FR_OUVRIR = /\b(ouvre|ouvrir|ouvres|lance|lancer|lances|demarre|demarrer|affiche|affiches)\b/;

/** Le NOM de l'objet réglé. Un verbe seul ne suffit pas : « monte » sans
 * « son » ni « volume » n'est pas une commande de volume. */
const FR_VOLUME_NOM = /\b(volume|son|sonnerie|silencieux|sourdine|muet)\b/;
const FR_VOLUME_SANS_NOM = /\b(plus fort|moins fort|trop fort|pas assez fort)\b/;

const FR_PHOTO = /\b(photo|photos|selfie|photographie|photographier)\b/;

const FR_AIDE = /\b(aide|aidez|aider|au secours|comment ca marche|que sais tu faire|qu est ce que tu sais faire)\b/;
const FR_REPETER = /\b(repete|repeter|repetes|redis|redire|encore une fois|comment|pardon|quoi)\b/;
/** `coupe` vit ici ET croise `FR_VOLUME_NOM` : « coupe le son » doit être un
 * réglage, pas un arrêt. C'est l'ordre des tests qui tranche (cf. plus bas). */
const FR_ARRETER = /\b(stop|arrete|arreter|arretes|annule|annuler|laisse tomber|tais toi|chut|coupe|coupes)\b/;

// ---------------------------------------------------------------------------
// Motifs dioula
// ---------------------------------------------------------------------------

/**
 * 🔵 À VALIDER PAR UN LOCUTEUR NATIF — hypothèse, pas acquis.
 *
 * Ces motifs sont proposés par l'agent de développement, qui n'est pas
 * dioulaphone. Ils sont regroupés ici, et nulle part ailleurs, pour qu'une
 * relecture par un locuteur ne touche qu'un seul endroit du code.
 *
 * Trois précautions ont été prises :
 * - pas de mot d'une ou deux lettres (`ja`, `kan`, `ta` sont écartés seuls :
 *   trop de collisions), sauf en séquence (`ja ta`) ;
 * - les emprunts français attestés à l'oral sont acceptés (`foto`, `volim`,
 *   `telefon`) — l'alternance codique est la norme, pas l'exception ;
 * - la forme normalisée est celle d'APRÈS `normaliser()` : `yɛlɛ` s'écrit
 *   donc `yele` ici, `dɛmɛ` s'écrit `deme`, `dɔgɔya` s'écrit `dogoya`.
 *
 * Ce qui MANQUE sciemment, plutôt que d'être deviné : la forme dioula de
 * « couper le son », et toute forme baoulé (le baoulé n'entre qu'avec sa
 * propre collecte).
 */
const DYU_APPELER = /\bwele\b|\bweele\b|\btelefon/;
const DYU_OUVRIR = /\byele\b|\bda yele\b/;
const DYU_VOLUME_NOM = /\bmankan\b|\bvolim/;
const DYU_VOLUME_SANS_NOM = /\bbonya\b|\bdogoya\b/;
const DYU_PHOTO = /\bfoto\b|\bja ta\b/;
const DYU_AIDE = /\bdeme\b|\bdemen\b/;
const DYU_REPETER = /\bkokura\b|\bsegin\b/;
const DYU_ARRETER = /\bdabila\b/;

// ---------------------------------------------------------------------------
// Routage
// ---------------------------------------------------------------------------

interface JeuMotifs {
  appeler: RegExp;
  ouvrir: RegExp;
  volumeNom: RegExp;
  volumeSansNom: RegExp;
  photo: RegExp;
  aide: RegExp;
  repeter: RegExp;
  arreter: RegExp;
}

const MOTIFS: Record<"fr" | "dyu", JeuMotifs> = {
  fr: {
    appeler: FR_APPELER,
    ouvrir: FR_OUVRIR,
    volumeNom: FR_VOLUME_NOM,
    volumeSansNom: FR_VOLUME_SANS_NOM,
    photo: FR_PHOTO,
    aide: FR_AIDE,
    repeter: FR_REPETER,
    arreter: FR_ARRETER,
  },
  dyu: {
    appeler: DYU_APPELER,
    ouvrir: DYU_OUVRIR,
    volumeNom: DYU_VOLUME_NOM,
    volumeSansNom: DYU_VOLUME_SANS_NOM,
    photo: DYU_PHOTO,
    aide: DYU_AIDE,
    repeter: DYU_REPETER,
    arreter: DYU_ARRETER,
  },
};

/** Le motif `clef` est-il rencontré dans l'une des langues actives ? */
function rencontre(texte: string, langue: LanguePass, clef: keyof JeuMotifs): boolean {
  return jeuxDeMotifs(langue).some((jeu) => MOTIFS[jeu][clef].test(texte));
}

/**
 * L'intention d'une commande PASS. L'ORDRE DES TESTS EST LA SPÉCIFICATION :
 * chacune des trois premières règles existe pour lever une ambiguïté précise,
 * et chacune est verrouillée par un test.
 *
 * 1. `appeler_contact` AVANT `assistance` — « aide-moi à appeler Awa » porte
 *    « aide » mais demande un appel. L'action demandée prime sur le mot
 *    d'accompagnement.
 * 2. `ouvrir_application` AVANT `prendre_photo` — « ouvre l'appareil photo »
 *    porte « photo » mais demande un LANCEMENT D'APPLICATION, pas une prise de
 *    vue. Le verbe explicite prime sur le nom de l'objet.
 * 3. `regler_volume` AVANT `assistance` — « coupe le son » porte « coupe »,
 *    qui est aussi un mot d'arrêt. Un réglage nommé prime sur un arrêt générique.
 *
 * Puis `prendre_photo`, puis `assistance`, et le défaut refuse.
 */
export function detecterIntentionPass(commande: string, langue: LanguePass = "fr"): IntentionPass {
  const t = normaliser(commande);
  if (!t) return "hors_perimetre";

  if (rencontre(t, langue, "appeler")) return "appeler_contact";
  if (rencontre(t, langue, "ouvrir")) return "ouvrir_application";
  if (rencontre(t, langue, "volumeNom") || rencontre(t, langue, "volumeSansNom")) return "regler_volume";
  if (rencontre(t, langue, "photo")) return "prendre_photo";
  if (
    rencontre(t, langue, "aide") ||
    rencontre(t, langue, "repeter") ||
    rencontre(t, langue, "arreter")
  ) {
    return "assistance";
  }
  return "hors_perimetre";
}

/** Le geste d'assistance demandé — l'ordre suit l'urgence : arrêter d'abord. */
export type GesteAssistance = "arreter" | "repeter" | "aide";

/**
 * Départage les trois gestes d'assistance. `arreter` est testé EN PREMIER :
 * quand la personne veut que ça s'arrête, tout le reste peut attendre.
 * Rend `null` si la commande n'est pas une assistance.
 */
export function detecterGesteAssistance(commande: string, langue: LanguePass = "fr"): GesteAssistance | null {
  const t = normaliser(commande);
  if (!t) return null;
  if (rencontre(t, langue, "arreter")) return "arreter";
  if (rencontre(t, langue, "repeter")) return "repeter";
  if (rencontre(t, langue, "aide")) return "aide";
  return null;
}
