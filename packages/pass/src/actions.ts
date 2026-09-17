import { z } from "zod";
import {
  detecterGesteAssistance,
  detecterIntentionPass,
  type GesteAssistance,
  type IntentionPass,
} from "./intentions";
import { jeuxDeMotifs, normaliser, type LanguePass } from "./langue";

/**
 * Les cinq actions PASS : leurs schémas, leur extraction depuis la parole, et
 * leur mise en forme pour le moteur Realtime.
 *
 * FRONTIÈRE ARCHITECTURALE — à lire avant de modifier ce fichier.
 *
 * Ce module NE FAIT RIEN. Il ne passe pas d'appel, n'ouvre pas d'application,
 * ne touche pas au volume. Il produit une `ActionPass` validée, et c'est tout.
 * L'exécution appartient au pont natif (`bridge.ts`), qui sera implémenté par
 * la couche Android au lot 3.
 *
 * C'est pourquoi ces actions ne sont PAS des `ToolDefinition` de `@suta/tools` :
 * cette interface impose un `execute()` côté serveur, et le serveur ne pilote
 * jamais le téléphone de quelqu'un. La divergence est délibérée.
 */

// ---------------------------------------------------------------------------
// Schémas
// ---------------------------------------------------------------------------

export const appelerContactSchema = z.object({
  /** Le libellé PRONONCÉ, normalisé — pas un numéro, pas un identifiant. La
   * correspondance avec le carnet d'adresses appartient au pont natif. */
  nom: z.string().min(1).max(80),
});

export const ouvrirApplicationSchema = z.object({
  /** Le libellé PRONONCÉ, normalisé (« whatsapp », « appareil photo »). La
   * résolution vers un paquet Android appartient au pont natif. */
  application: z.string().min(1).max(80),
});

export const reglerVolumeSchema = z.object({
  sens: z.enum(["monter", "baisser", "couper", "definir"]),
  /** Obligatoire quand `sens` vaut `definir`, interdit sinon (cf. `resoudreAction`). */
  niveau: z.number().int().min(0).max(100).optional(),
});

export const prendrePhotoSchema = z.object({
  camera: z.enum(["arriere", "avant"]).default("arriere"),
});

export const assistanceSchema = z.object({
  geste: z.enum(["aide", "repeter", "arreter"]),
});

export type AppelerContact = z.infer<typeof appelerContactSchema>;
export type OuvrirApplication = z.infer<typeof ouvrirApplicationSchema>;
export type ReglerVolume = z.infer<typeof reglerVolumeSchema>;
export type PrendrePhoto = z.infer<typeof prendrePhotoSchema>;
export type Assistance = z.infer<typeof assistanceSchema>;

/** Une action PASS validée, prête à être remise au pont natif. */
export type ActionPass =
  | { nom: "appeler_contact"; entree: AppelerContact }
  | { nom: "ouvrir_application"; entree: OuvrirApplication }
  | { nom: "regler_volume"; entree: ReglerVolume }
  | { nom: "prendre_photo"; entree: PrendrePhoto }
  | { nom: "assistance"; entree: Assistance };

export type NomActionPass = ActionPass["nom"];

/** Les noms d'action valides — l'ordre est celui de la première tranche. */
export const NOMS_ACTIONS_PASS = [
  "appeler_contact",
  "ouvrir_application",
  "regler_volume",
  "prendre_photo",
  "assistance",
] as const;

const SCHEMAS: Record<NomActionPass, z.ZodType> = {
  appeler_contact: appelerContactSchema,
  ouvrir_application: ouvrirApplicationSchema,
  regler_volume: reglerVolumeSchema,
  prendre_photo: prendrePhotoSchema,
  assistance: assistanceSchema,
};

const DESCRIPTIONS: Record<NomActionPass, string> = {
  appeler_contact:
    "Appelle une personne du carnet d'adresses du téléphone. Donner le nom tel qu'il a été prononcé.",
  ouvrir_application:
    "Ouvre une application installée sur le téléphone. Donner le nom tel qu'il a été prononcé.",
  regler_volume:
    "Règle le volume du téléphone : monter, baisser, couper, ou définir un niveau précis de 0 à 100.",
  prendre_photo: "Prend une photo avec l'appareil du téléphone, caméra arrière par défaut.",
  assistance:
    "Répond à une demande d'assistance : expliquer ce que PASS sait faire (aide), redire la dernière réponse (repeter), interrompre ce qui est en cours (arreter).",
};

/** Description au format attendu par un moteur Realtime — même forme que
 * `describeTool` de `@suta/tools`, sans l'`execute()` que PASS ne peut pas avoir. */
export interface DescripteurActionPass {
  name: NomActionPass;
  description: string;
  parameters: Record<string, unknown>;
}

export function decrireActionsPass(): DescripteurActionPass[] {
  return NOMS_ACTIONS_PASS.map((nom) => ({
    name: nom,
    description: DESCRIPTIONS[nom],
    parameters: z.toJSONSchema(SCHEMAS[nom]) as Record<string, unknown>,
  }));
}

export function estNomActionPass(valeur: unknown): valeur is NomActionPass {
  return typeof valeur === "string" && (NOMS_ACTIONS_PASS as readonly string[]).includes(valeur);
}

// ---------------------------------------------------------------------------
// Validation d'un appel d'outil (chemin EN LIGNE : le modèle a déjà décidé)
// ---------------------------------------------------------------------------

export type ValidationAction =
  | { ok: true; action: ActionPass }
  | { ok: false; erreur: string };

/**
 * Valide un appel d'outil brut. C'est l'unique porte d'entrée du chemin en
 * ligne : le moteur Realtime nomme l'action et fournit ses arguments, et rien
 * n'est remis au pont natif sans être passé par ici.
 */
export function validerAction(nom: unknown, entree: unknown): ValidationAction {
  if (!estNomActionPass(nom)) {
    return { ok: false, erreur: `Action inconnue : ${String(nom)}.` };
  }
  const parsed = SCHEMAS[nom].safeParse(entree ?? {});
  if (!parsed.success) {
    return { ok: false, erreur: `Entrée invalide pour « ${nom} » : ${parsed.error.message}` };
  }
  if (nom === "regler_volume") {
    const volume = parsed.data as ReglerVolume;
    if (volume.sens === "definir" && volume.niveau === undefined) {
      return { ok: false, erreur: "Un niveau de 0 à 100 est requis pour définir le volume." };
    }
    if (volume.sens !== "definir" && volume.niveau !== undefined) {
      return { ok: false, erreur: "Un niveau ne se donne qu'avec le sens « definir »." };
    }
  }
  return { ok: true, action: { nom, entree: parsed.data } as ActionPass };
}

// ---------------------------------------------------------------------------
// Extraction depuis la parole (chemin HORS LIGNE : aucun modèle disponible)
// ---------------------------------------------------------------------------

/** Mots qui entourent une cible sans la nommer, retirés des libellés extraits. */
const VIDES_FR = new Set([
  "moi", "a", "au", "aux", "le", "la", "les", "l", "un", "une", "de", "du", "des",
  "mon", "ma", "mes", "s", "il", "te", "vous", "plait", "stp", "svp", "please",
  "numero", "tout", "suite", "maintenant", "vite", "pour", "sur", "dans",
  "application", "appli", "app", "je", "veux", "voudrais", "peux", "tu",
]);

/** 🔵 À VALIDER PAR UN LOCUTEUR NATIF — mêmes réserves que dans `intentions.ts`. */
const VIDES_DYU = new Set(["n", "ne", "ka", "ko", "bi", "be", "fe", "kan", "la", "ma", "i"]);

function motsUtiles(segment: string, langue: LanguePass): string[] {
  const vides = langue === "dyu" ? new Set([...VIDES_FR, ...VIDES_DYU]) : VIDES_FR;
  return segment.split(" ").filter((mot) => mot.length > 0 && !vides.has(mot));
}

/** Les verbes qui introduisent (français) ou suivent (dioula) la cible. */
const VERBE_APPEL_FR = /\b(?:appelle|appeler|appelles|rappelle|rappeler|joins|joindre|telephone a|telephone au|telephoner a)\b/;
const VERBE_APPEL_DYU = /\b(?:wele|weele)\b/;
const VERBE_OUVRIR_FR = /\b(?:ouvre|ouvrir|ouvres|lance|lancer|lances|demarre|demarrer|affiche|affiches)\b/;
const VERBE_OUVRIR_DYU = /\b(?:yele)\b/;

/**
 * Extrait la cible d'une commande, des deux côtés du verbe selon la langue.
 *
 * 🔵 HYPOTHÈSE STRUCTURELLE À VALIDER : le français est SVO (« appelle Awa » —
 * la cible SUIT le verbe) tandis que les langues mandingues sont SOV
 * (« Awa wele » — la cible PRÉCÈDE le verbe). L'extraction lit donc à droite
 * en français et à gauche en dioula. C'est la règle générale de la famille ;
 * elle demande confirmation sur des énoncés réels avant d'être tenue pour
 * acquise.
 *
 * Le libellé rendu est NORMALISÉ (sans majuscules ni accents) : le pont natif
 * fait la correspondance avec le carnet ou la liste des applications, où la
 * comparaison est de toute façon insensible à la casse.
 */
function extraireCible(
  commande: string,
  langue: LanguePass,
  verbeFr: RegExp,
  verbeDyu: RegExp,
): string | null {
  const t = normaliser(commande);
  for (const jeu of jeuxDeMotifs(langue)) {
    const verbe = jeu === "dyu" ? verbeDyu : verbeFr;
    const trouve = verbe.exec(t);
    if (!trouve) continue;
    const segment =
      jeu === "dyu"
        ? t.slice(0, trouve.index) // SOV : la cible précède le verbe
        : t.slice(trouve.index + trouve[0].length); // SVO : la cible suit le verbe
    const mots = motsUtiles(segment, langue);
    if (mots.length > 0) {
      // Quatre mots au plus : au-delà, ce n'est plus un nom mais une phrase.
      return mots.slice(jeu === "dyu" ? -4 : 0, jeu === "dyu" ? undefined : 4).join(" ");
    }
  }
  return null;
}

export function extraireNomContact(commande: string, langue: LanguePass = "fr"): string | null {
  return extraireCible(commande, langue, VERBE_APPEL_FR, VERBE_APPEL_DYU);
}

export function extraireApplication(commande: string, langue: LanguePass = "fr"): string | null {
  return extraireCible(commande, langue, VERBE_OUVRIR_FR, VERBE_OUVRIR_DYU);
}

const VOLUME_COUPER = /\b(coupe|coupes|couper|muet|silencieux|sourdine|silence)\b/;
const VOLUME_BAISSER = /\b(baisse|baisses|baisser|diminue|diminuer|reduis|reduire|moins fort|trop fort)\b/;
const VOLUME_MONTER = /\b(monte|montes|monter|augmente|augmentes|augmenter|plus fort|pas assez fort)\b/;
/** 🔵 À VALIDER : `bonya` (augmenter) et `dɔgɔya` (diminuer). Aucune forme
 * dioula n'est proposée pour « couper » — elle est manquante, pas devinée. */
const VOLUME_MONTER_DYU = /\bbonya\b/;
const VOLUME_BAISSER_DYU = /\bdogoya\b/;
const VOLUME_NIVEAU = /\b(?:a|sur|niveau)\s+(\d{1,3})\b|\b(\d{1,3})\s*(?:%|pour cent)/;

/**
 * Le sens du réglage, et le niveau s'il est dit. Rend `null` quand la commande
 * nomme le volume sans dire quoi en faire (« le son ! ») : dans ce cas PASS
 * DEMANDE au lieu de choisir — un réglage au hasard est une action subie.
 */
export function analyserVolume(commande: string, langue: LanguePass = "fr"): ReglerVolume | null {
  const t = normaliser(commande);
  const niveau = VOLUME_NIVEAU.exec(t);
  if (niveau) {
    const valeur = Number(niveau[1] ?? niveau[2]);
    if (Number.isInteger(valeur) && valeur >= 0 && valeur <= 100) {
      return { sens: "definir", niveau: valeur };
    }
  }
  if (VOLUME_COUPER.test(t)) return { sens: "couper" };
  if (VOLUME_BAISSER.test(t)) return { sens: "baisser" };
  if (VOLUME_MONTER.test(t)) return { sens: "monter" };
  if (langue === "dyu") {
    if (VOLUME_BAISSER_DYU.test(t)) return { sens: "baisser" };
    if (VOLUME_MONTER_DYU.test(t)) return { sens: "monter" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Résolution complète : de la parole à l'action (ou au refus, ou à la question)
// ---------------------------------------------------------------------------

/**
 * Le résultat du routage hors ligne. Trois issues, jamais d'autre :
 * - `prete`     : l'action est validée, le pont peut l'exécuter ;
 * - `precision` : l'intention est comprise mais la cible manque — PASS demande ;
 * - `refusee`   : la commande n'est pas du périmètre PASS — PASS n'agit pas.
 */
export type ResolutionPass =
  | { statut: "prete"; intention: IntentionPass; action: ActionPass }
  | { statut: "precision"; intention: IntentionPass; question: string }
  | { statut: "refusee"; intention: "hors_perimetre" };

const QUESTIONS: Record<string, string> = {
  appeler_contact: "Qui voulez-vous appeler ?",
  ouvrir_application: "Quelle application voulez-vous ouvrir ?",
  regler_volume: "Voulez-vous monter, baisser ou couper le son ?",
};

/**
 * Le chemin HORS LIGNE de bout en bout : une commande parlée entre, une action
 * validée sort — ou une question, ou un refus. Aucun réseau, aucun modèle.
 */
export function resoudreAction(commande: string, langue: LanguePass = "fr"): ResolutionPass {
  const intention = detecterIntentionPass(commande, langue);

  switch (intention) {
    case "appeler_contact": {
      const nom = extraireNomContact(commande, langue);
      if (!nom) return { statut: "precision", intention, question: QUESTIONS.appeler_contact };
      return { statut: "prete", intention, action: { nom: "appeler_contact", entree: { nom } } };
    }
    case "ouvrir_application": {
      const application = extraireApplication(commande, langue);
      if (!application) {
        return { statut: "precision", intention, question: QUESTIONS.ouvrir_application };
      }
      return {
        statut: "prete",
        intention,
        action: { nom: "ouvrir_application", entree: { application } },
      };
    }
    case "regler_volume": {
      const reglage = analyserVolume(commande, langue);
      if (!reglage) return { statut: "precision", intention, question: QUESTIONS.regler_volume };
      return { statut: "prete", intention, action: { nom: "regler_volume", entree: reglage } };
    }
    case "prendre_photo":
      return {
        statut: "prete",
        intention,
        action: { nom: "prendre_photo", entree: { camera: "arriere" } },
      };
    case "assistance": {
      const geste: GesteAssistance = detecterGesteAssistance(commande, langue) ?? "aide";
      return { statut: "prete", intention, action: { nom: "assistance", entree: { geste } } };
    }
    default:
      return { statut: "refusee", intention: "hors_perimetre" };
  }
}
