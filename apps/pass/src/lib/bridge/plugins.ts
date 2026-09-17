import type { CodeEchec, ReglerVolume } from "@suta/pass";

/**
 * Les deux greffons Kotlin écrits pour PASS, et leur contrat TypeScript.
 *
 * Aucun greffon publié ne sait piloter `AudioManager` ni `PackageManager` :
 * ces deux-là sont donc maison (`android/app/src/main/java/.../`). Leur
 * surface est volontairement minuscule.
 *
 * ── CE QUE CES GREFFONS N'ONT PAS LE DROIT DE FAIRE ─────────────────────
 *
 * Ils ne décident de rien. `listerApplications` énumère sans filtrer ;
 * `ouvrirPaquet` et `ouvrirComposeur` reçoivent une cible DÉJÀ désignée par
 * `correspondance.ts`. Le seul type du contrat du lot 1 qui descende jusqu'au
 * Kotlin est `ReglerVolume` — ses quatre valeurs de `sens` sont celles de
 * `packages/pass/src/actions.ts`, et le greffon rejette tout le reste.
 */

/** Ce que rend un greffon maison : jamais une exception pour un refus. */
export interface ReponseGreffon {
  ok: boolean;
  code?: CodeEchec;
  detail?: string;
}

export interface SutaVolumePlugin {
  capacites(): Promise<{ disponible: boolean }>;
  /** Accepte EXACTEMENT le type `ReglerVolume` du lot 1, rien d'autre. */
  reglerVolume(options: ReglerVolume): Promise<ReponseGreffon>;
}

export interface ApplicationInstallee {
  libelle: string;
  paquet: string;
}

export interface SutaLauncherPlugin {
  capacites(): Promise<{ listerApplications: boolean; ouvrirComposeur: boolean }>;
  /** Énumère sans filtrer ni trier par pertinence : l'appariement est en TS. */
  listerApplications(): Promise<{ applications: ApplicationInstallee[] }>;
  ouvrirPaquet(options: { paquet: string }): Promise<ReponseGreffon>;
  /**
   * Ouvre le composeur PRÉ-REMPLI (`Intent.ACTION_DIAL`). Il ne passe JAMAIS
   * l'appel : c'est la personne qui appuie. C'est la réponse à « aucune action
   * sensible exécutée silencieusement », et cela évite du même coup la
   * permission `CALL_PHONE`, restreinte par Google Play.
   */
  ouvrirComposeur(options: { numero: string }): Promise<ReponseGreffon>;
}
