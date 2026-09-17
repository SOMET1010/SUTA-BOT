import type { PontNatif, ReglerVolume } from "@suta/pass";
import type { Adaptateurs } from "./adaptateurs";
import type { Candidat } from "./correspondance";
import { creerPont } from "./pont";
import type { ApplicationInstallee, ReponseGreffon } from "./plugins";

/**
 * Le pont simulé : mêmes décisions, plateforme feinte.
 *
 * Il ne réimplémente RIEN. `creerPont` est le même que sur le téléphone ; ce
 * simulateur ne remplace que les quatre adaptateurs. Un test qui passe ici
 * exerce donc l'enchaînement réel des permissions, la règle des homonymes et
 * la formulation des refus — pas une imitation.
 *
 * Il sert aussi dans le navigateur : l'écran technique tourne sans Android,
 * ce qui permet de mettre au point l'interface sans reconstruire un APK.
 */

export const CONTACTS_DEMO: Candidat[] = [
  { libelle: "Awa Koné", valeur: "+2250700000001" },
  { libelle: "Awa Traoré", valeur: "+2250700000002" }, // homonyme volontaire
  { libelle: "Kouassi N'Guessan", valeur: "+2250700000003" },
  { libelle: "Mariam", valeur: "+2250700000004" },
  { libelle: "Mariam", valeur: "+2250700000004" }, // doublon strict : pas une ambiguïté
  { libelle: "Yao", valeur: "+2250700000005" },
  { libelle: "Yao", valeur: "+2250700000006" }, // même nom, deux numéros
];

export const APPLICATIONS_DEMO: ApplicationInstallee[] = [
  { libelle: "WhatsApp", paquet: "com.whatsapp" },
  { libelle: "Appareil photo", paquet: "com.android.camera2" },
  { libelle: "Téléphone", paquet: "com.android.dialer" },
  { libelle: "Messages", paquet: "com.google.android.apps.messaging" },
  { libelle: "Orange Money", paquet: "com.orange.money.ci" },
  { libelle: "Paramètres", paquet: "com.android.settings" },
];

export interface ReglagesSimules {
  contacts?: Candidat[];
  applications?: ApplicationInstallee[];
  /** Simule un refus de permission contacts. */
  permissionContacts?: boolean;
  /** Simule un refus de permission caméra. */
  permissionCamera?: boolean;
  /** Simule un terminal sans greffon volume. */
  volumeDisponible?: boolean;
  /** Simule un terminal sans lanceur. */
  lanceurDisponible?: boolean;
  /** Fait lever une exception à la caméra — pour vérifier qu'elle est contenue. */
  erreurCamera?: Error;
}

export interface PontSimule {
  pont: PontNatif;
  /** Ce que la plateforme a réellement reçu — l'ordre compte. */
  journal: string[];
  /** Le dernier niveau de volume demandé, ou null. */
  volume: () => ReglerVolume | null;
}

const OK: ReponseGreffon = { ok: true };

export function creerPontSimule(reglages: ReglagesSimules = {}): PontSimule {
  const journal: string[] = [];
  let dernierVolume: ReglerVolume | null = null;

  const adaptateurs: Adaptateurs = {
    volume: {
      capacites: async () => ({ disponible: reglages.volumeDisponible ?? true }),
      reglerVolume: async (options) => {
        journal.push(`volume:${options.sens}${options.niveau !== undefined ? `:${options.niveau}` : ""}`);
        dernierVolume = options;
        return OK;
      },
    },
    lanceur: {
      capacites: async () => ({
        listerApplications: reglages.lanceurDisponible ?? true,
        ouvrirComposeur: reglages.lanceurDisponible ?? true,
      }),
      listerApplications: async () => {
        journal.push("listerApplications");
        return { applications: reglages.applications ?? APPLICATIONS_DEMO };
      },
      ouvrirPaquet: async ({ paquet }) => {
        journal.push(`ouvrirPaquet:${paquet}`);
        return OK;
      },
      ouvrirComposeur: async ({ numero }) => {
        journal.push(`ouvrirComposeur:${numero}`);
        return OK;
      },
    },
    contacts: {
      permission: async () => {
        journal.push("permissionContacts");
        return reglages.permissionContacts ?? true;
      },
      lister: async () => {
        journal.push("listerContacts");
        return reglages.contacts ?? CONTACTS_DEMO;
      },
    },
    camera: {
      permission: async () => {
        journal.push("permissionCamera");
        return reglages.permissionCamera ?? true;
      },
      prendre: async (entree) => {
        journal.push(`prendrePhoto:${entree.camera}`);
        if (reglages.erreurCamera) throw reglages.erreurCamera;
        return { uri: "file:///simulation/photo.jpg" };
      },
    },
  };

  return { pont: creerPont(adaptateurs), journal, volume: () => dernierVolume };
}
