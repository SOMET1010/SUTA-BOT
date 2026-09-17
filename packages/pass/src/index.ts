/**
 * `@suta/pass` — le cœur de SUTA PASS : routage d'intentions, schémas
 * d'actions et contrat du pont natif.
 *
 * Module PUR : aucune dépendance React, aucune dépendance de plateforme,
 * aucun accès réseau. Il tourne identiquement dans un test Node, dans la
 * WebView Android et dans une route serveur — c'est ce qui permet au chemin
 * HORS LIGNE d'être exactement le même code que le chemin en ligne.
 */
export { normaliser, jeuxDeMotifs, type LanguePass } from "./langue";
export {
  detecterIntentionPass,
  detecterGesteAssistance,
  type IntentionPass,
  type GesteAssistance,
} from "./intentions";
export {
  NOMS_ACTIONS_PASS,
  appelerContactSchema,
  ouvrirApplicationSchema,
  reglerVolumeSchema,
  prendrePhotoSchema,
  assistanceSchema,
  decrireActionsPass,
  estNomActionPass,
  validerAction,
  extraireNomContact,
  extraireApplication,
  analyserVolume,
  resoudreAction,
  type ActionPass,
  type NomActionPass,
  type AppelerContact,
  type OuvrirApplication,
  type ReglerVolume,
  type PrendrePhoto,
  type Assistance,
  type DescripteurActionPass,
  type ValidationAction,
  type ResolutionPass,
} from "./actions";
export {
  executerAction,
  type PontNatif,
  type CapacitesPont,
  type ResultatAction,
  type CodeEchec,
} from "./bridge";
export {
  exigeConfirmation,
  demandeConfirmation,
  annonce,
  messageResultat,
  messageRefus,
  type PhrasePass,
} from "./confirmation";
