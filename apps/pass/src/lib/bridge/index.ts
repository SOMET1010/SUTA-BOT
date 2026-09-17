import { Capacitor } from "@capacitor/core";
import type { PontNatif } from "@suta/pass";
import { creerPontSimule } from "./mock";

/**
 * Le pont utilisé par l'application, choisi à l'exécution.
 *
 * Sur Android, le pont réel. Partout ailleurs — navigateur de développement,
 * `next build`, tests — le pont simulé. Ce n'est pas une commodité : les
 * greffons Capacitor n'existent tout simplement pas hors de l'application
 * empaquetée, et un import statique du pont réel ferait échouer la
 * prégénération statique de Next.
 *
 * D'où l'import DYNAMIQUE : `@capacitor-community/contacts` et
 * `@capacitor/camera` ne sont chargés que sur une plateforme native.
 */
export async function obtenirPont(): Promise<{ pont: PontNatif; natif: boolean }> {
  if (Capacitor.isNativePlatform()) {
    const { pontCapacitor } = await import("./capacitor");
    return { pont: pontCapacitor, natif: true };
  }
  return { pont: creerPontSimule().pont, natif: false };
}

export { creerPontSimule, CONTACTS_DEMO, APPLICATIONS_DEMO } from "./mock";
export { apparier, type Candidat, type Correspondance } from "./correspondance";
export { creerPont, codeDepuisErreur } from "./pont";
export type { Adaptateurs } from "./adaptateurs";
export type { SutaVolumePlugin, SutaLauncherPlugin, ApplicationInstallee } from "./plugins";
