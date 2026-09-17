import type { ActionPass, AppelerContact, OuvrirApplication, PrendrePhoto, ReglerVolume } from "./actions";

/**
 * LE CONTRAT ENTRE `@suta/pass` ET LA FUTURE COUCHE ANDROID.
 *
 * Ce fichier est la frontière. Tout ce qui est au-dessus (routage, schémas,
 * confirmations) est du TypeScript pur, testable sans téléphone. Tout ce qui
 * est en dessous — Capacitor, Kotlin, permissions, `AudioManager`,
 * `PackageManager`, `CameraX` — sera écrit au lot 3 et ne connaîtra de PASS
 * que cette interface.
 *
 * Trois règles tiennent la frontière :
 *
 * 1. `PontNatif` ne reçoit QUE des entrées déjà validées. Aucune méthode ne
 *    prend de texte libre : la parole a été routée et vérifiée en amont.
 * 2. Aucune méthode ne LÈVE d'exception attendue. Un refus de permission, une
 *    application absente, un appareil photo indisponible sont des résultats
 *    normaux (`ok: false` + `code`), pas des erreurs de programmation.
 * 3. `assistance` n'est PAS dans l'interface. Aide, répétition et arrêt se
 *    traitent entièrement côté conversation ; le pont n'a rien à faire.
 */

/** Pourquoi une action n'a pas abouti. Cette liste est fermée : le pont ne
 * doit jamais inventer un code, la conversation sait répondre à chacun. */
export type CodeEchec =
  | "permission_refusee" // l'utilisateur a refusé, ou la permission n'est pas accordée
  | "introuvable" // contact absent du carnet, application non installée
  | "non_supporte" // l'appareil ou la version d'Android ne sait pas faire
  | "annule_par_utilisateur" // l'utilisateur est sorti de l'écran natif
  | "erreur_interne"; // tout le reste — journalisé, jamais énoncé tel quel

export interface ResultatAction {
  ok: boolean;
  /** Une phrase courte, prête à être dite. Jamais un message technique. */
  message: string;
  /** Renseigné si et seulement si `ok` est faux. */
  code?: CodeEchec;
  /** Détail technique pour la journalisation — jamais énoncé à la personne. */
  detail?: string;
}

/**
 * Ce que le terminal sait faire réellement. Rempli par la couche Android au
 * démarrage : une permission refusée définitivement ou une version d'Android
 * trop ancienne se déclarent ICI, pour que PASS le dise AVANT d'essayer plutôt
 * que d'échouer devant la personne.
 */
export interface CapacitesPont {
  appelerContact: boolean;
  ouvrirApplication: boolean;
  reglerVolume: boolean;
  prendrePhoto: boolean;
}

/**
 * L'interface que la couche Android implémentera au lot 3.
 *
 * Deux implémentations sont prévues : `capacitor.ts` (réelle) et `mock.ts`
 * (tests et navigateur). Aucune des deux n'existe dans ce lot — seul le
 * contrat est figé, pour que le lot 3 n'ait pas à renégocier la frontière.
 */
export interface PontNatif {
  capacites(): Promise<CapacitesPont>;
  appelerContact(entree: AppelerContact): Promise<ResultatAction>;
  ouvrirApplication(entree: OuvrirApplication): Promise<ResultatAction>;
  reglerVolume(entree: ReglerVolume): Promise<ResultatAction>;
  prendrePhoto(entree: PrendrePhoto): Promise<ResultatAction>;
}

/** Ce que PASS répond quand le terminal ne sait pas faire — dit avant d'essayer. */
const INDISPONIBLE: Record<keyof CapacitesPont, string> = {
  appelerContact: "Je ne peux pas passer d'appel depuis ce téléphone.",
  ouvrirApplication: "Je ne peux pas ouvrir d'application depuis ce téléphone.",
  reglerVolume: "Je ne peux pas régler le volume de ce téléphone.",
  prendrePhoto: "Je ne peux pas utiliser l'appareil photo de ce téléphone.",
};

/** L'action correspond à quelle capacité ? `assistance` n'en consomme aucune. */
function capaciteRequise(action: ActionPass): keyof CapacitesPont | null {
  switch (action.nom) {
    case "appeler_contact":
      return "appelerContact";
    case "ouvrir_application":
      return "ouvrirApplication";
    case "regler_volume":
      return "reglerVolume";
    case "prendre_photo":
      return "prendrePhoto";
    case "assistance":
      return null;
  }
}

/**
 * Remet une action validée au pont natif, après avoir vérifié que le terminal
 * sait la faire. `assistance` ne descend jamais jusqu'au pont.
 *
 * Les capacités sont passées en paramètre plutôt que lues ici : l'appelant les
 * obtient une fois au démarrage, et une action ne doit pas coûter un
 * aller-retour natif supplémentaire avant même de commencer.
 */
export async function executerAction(
  pont: PontNatif,
  action: ActionPass,
  capacites: CapacitesPont,
): Promise<ResultatAction> {
  const requise = capaciteRequise(action);
  if (requise === null) {
    return { ok: false, message: "", code: "non_supporte", detail: "assistance ne passe pas par le pont" };
  }
  if (!capacites[requise]) {
    return { ok: false, message: INDISPONIBLE[requise], code: "non_supporte" };
  }
  switch (action.nom) {
    case "appeler_contact":
      return pont.appelerContact(action.entree);
    case "ouvrir_application":
      return pont.ouvrirApplication(action.entree);
    case "regler_volume":
      return pont.reglerVolume(action.entree);
    case "prendre_photo":
      return pont.prendrePhoto(action.entree);
    default:
      return { ok: false, message: "", code: "erreur_interne" };
  }
}
