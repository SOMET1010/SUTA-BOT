import type { PrendrePhoto } from "@suta/pass";
import type { Candidat } from "./correspondance";
import type { SutaLauncherPlugin, SutaVolumePlugin } from "./plugins";

/**
 * La couche d'adaptation : tout ce que le pont demande à la plateforme.
 *
 * ── POURQUOI CETTE INTERFACE EXISTE ─────────────────────────────────────
 *
 * Sans elle, la logique du pont — enchaînement des permissions, règle des
 * homonymes, formulation des refus — ne serait exécutable que sur un
 * téléphone, c'est-à-dire nulle part au banc. Nous serions réduits à tester
 * un simulacre du pont en espérant qu'il ressemble au vrai.
 *
 * Avec elle, `creerPont` est écrit UNE fois et tourne à l'identique dans les
 * deux mondes : seuls les quatre adaptateurs ci-dessous changent. Les tests
 * exercent donc le code qui tournera réellement sur l'appareil ; ce qui reste
 * à vérifier sur terminal se réduit aux adaptateurs eux-mêmes.
 */
export interface Adaptateurs {
  volume: SutaVolumePlugin;
  lanceur: SutaLauncherPlugin;
  contacts: {
    /** Vrai si la permission est accordée — après l'avoir demandée si besoin. */
    permission(): Promise<boolean>;
    /** Le carnet, à plat : une entrée par couple (nom, numéro). */
    lister(): Promise<Candidat[]>;
  };
  camera: {
    permission(): Promise<boolean>;
    prendre(entree: PrendrePhoto): Promise<{ uri?: string }>;
  };
}
