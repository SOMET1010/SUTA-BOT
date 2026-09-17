import { Contacts } from "@capacitor-community/contacts";
import { Camera, CameraDirection } from "@capacitor/camera";
import { registerPlugin } from "@capacitor/core";
import type { PontNatif } from "@suta/pass";
import type { Adaptateurs } from "./adaptateurs";
import type { Candidat } from "./correspondance";
import { creerPont } from "./pont";
import type { SutaLauncherPlugin, SutaVolumePlugin } from "./plugins";

/**
 * Les adaptateurs réels : la seule partie du pont qui ne peut PAS être
 * vérifiée au banc. Tout ce qui décide est dans `pont.ts` et testé ; ici, il
 * n'y a que des appels de greffon et la traduction de leurs formes.
 *
 * Les deux greffons maison sont enregistrés sous les noms que déclarent leurs
 * classes Kotlin (`@CapacitorPlugin(name = "SutaVolume" | "SutaLauncher")`).
 * Ces deux chaînes sont le seul couplage par nom du projet ; elles doivent
 * rester identiques des deux côtés.
 */

const SutaVolume = registerPlugin<SutaVolumePlugin>("SutaVolume");
const SutaLauncher = registerPlugin<SutaLauncherPlugin>("SutaLauncher");

/**
 * Demande une permission si elle n'est pas déjà accordée.
 *
 * `granted` et `limited` passent ; `denied` signifie refus — définitif si
 * Android ne repropose plus la boîte de dialogue. Dans tous les cas le pont
 * rend un résultat explicite, jamais une exception.
 */
const adaptateursCapacitor: Adaptateurs = {
  volume: SutaVolume,
  lanceur: SutaLauncher,
  contacts: {
    async permission() {
      const etat = await Contacts.checkPermissions();
      if (etat.contacts === "granted" || etat.contacts === "limited") return true;
      const apres = await Contacts.requestPermissions();
      return apres.contacts === "granted" || apres.contacts === "limited";
    },
    async lister() {
      const { contacts } = await Contacts.getContacts({ projection: { name: true, phones: true } });
      const candidats: Candidat[] = [];
      for (const contact of contacts) {
        const libelle = contact.name?.display?.trim();
        if (!libelle) continue;
        for (const telephone of contact.phones ?? []) {
          const numero = telephone.number?.trim();
          if (numero) candidats.push({ libelle, valeur: numero });
        }
      }
      return candidats;
    },
  },
  camera: {
    async permission() {
      const etat = await Camera.checkPermissions();
      if (etat.camera === "granted" || etat.camera === "limited") return true;
      const apres = await Camera.requestPermissions({ permissions: ["camera"] });
      return apres.camera === "granted" || apres.camera === "limited";
    },
    async prendre(entree) {
      const media = await Camera.takePhoto({
        quality: 85,
        correctOrientation: true,
        // Lot 2 : la photo n'est PAS enregistrée dans la galerie. Cela évite
        // d'ajouter une permission de stockage pour une démonstration de pont ;
        // le lot suivant décidera de ce qu'on fait de l'image.
        saveToGallery: false,
        cameraDirection: entree.camera === "avant" ? CameraDirection.Front : CameraDirection.Rear,
      });
      return { uri: media.uri };
    },
  },
};

/** Le pont Android réel, conforme au contrat figé au lot 1. */
export const pontCapacitor: PontNatif = creerPont(adaptateursCapacitor);
