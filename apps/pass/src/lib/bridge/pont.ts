import type {
  AppelerContact,
  CapacitesPont,
  CodeEchec,
  OuvrirApplication,
  PontNatif,
  PrendrePhoto,
  ReglerVolume,
  ResultatAction,
} from "@suta/pass";
import type { Adaptateurs } from "./adaptateurs";
import { apparier } from "./correspondance";
import type { ReponseGreffon } from "./plugins";

/**
 * Le pont, écrit une seule fois pour les deux mondes (cf. `adaptateurs.ts`).
 *
 * ── LA RÈGLE QUI TIENT TOUT LE FICHIER ──────────────────────────────────
 *
 *   AUCUNE MÉTHODE NE LAISSE ÉCHAPPER D'EXCEPTION.
 *
 * Le contrat du lot 1 l'exige : un refus de permission, une application
 * absente, un appareil photo fermé sont des RÉSULTATS (`ok: false` + `code`),
 * jamais des erreurs de programmation. Chaque méthode publique passe par
 * `sansEclat` ; une exception inattendue devient `erreur_interne`, son détail
 * est journalisé et n'est jamais énoncé.
 */

function detail(erreur: unknown): string {
  if (erreur instanceof Error) return `${erreur.name}: ${erreur.message}`;
  return String(erreur);
}

/**
 * Traduit une exception de greffon en `CodeEchec`.
 *
 * 🔵 À CONFIRMER SUR TERMINAL : les libellés d'erreur des greffons publiés
 * (caméra, contacts) ne sont pas un contrat documenté et changent d'une
 * version à l'autre. Le repli `erreur_interne` reste toujours correct — au
 * pire imprécis. La recette doit vérifier qu'une annulation de la caméra rend
 * bien `annule_par_utilisateur`.
 */
export function codeDepuisErreur(erreur: unknown): CodeEchec {
  const message = detail(erreur).toLowerCase();
  if (/(cancel|annul|dismiss)/.test(message)) return "annule_par_utilisateur";
  if (/(denied|permission|refus)/.test(message)) return "permission_refusee";
  if (/(not available|unavailable|unimplemented|not implemented)/.test(message)) return "non_supporte";
  return "erreur_interne";
}

async function sansEclat(action: () => Promise<ResultatAction>): Promise<ResultatAction> {
  try {
    return await action();
  } catch (erreur) {
    const code = codeDepuisErreur(erreur);
    console.error("[pont] échec", code, detail(erreur));
    return { ok: false, message: "", code, detail: detail(erreur) };
  }
}

function depuisGreffon(reponse: ReponseGreffon, messageSucces: string): ResultatAction {
  if (reponse.ok) return { ok: true, message: messageSucces };
  return {
    ok: false,
    message: "",
    code: reponse.code ?? "erreur_interne",
    ...(reponse.detail ? { detail: reponse.detail } : {}),
  };
}

const REFUS_CONTACTS: ResultatAction = {
  ok: false,
  message: "Je n'ai pas accès à vos contacts. Vous pouvez m'y autoriser dans les réglages du téléphone.",
  code: "permission_refusee",
};

const REFUS_CAMERA: ResultatAction = {
  ok: false,
  message: "Je n'ai pas accès à l'appareil photo. Vous pouvez m'y autoriser dans les réglages du téléphone.",
  code: "permission_refusee",
};

export function creerPont(adaptateurs: Adaptateurs): PontNatif {
  /**
   * Ce que ce terminal sait faire.
   *
   * ATTENTION à ne pas confondre capacité et permission. Une permission pas
   * encore demandée n'est PAS une incapacité : la capacité dit « ce greffon
   * existe et cette plateforme sait faire », la permission se joue au moment
   * de l'action et rend `permission_refusee`. Déclarer ici qu'on ne sait pas
   * appeler parce que `READ_CONTACTS` n'a jamais été demandée priverait la
   * personne de la boîte de dialogue qui la lui accorderait.
   */
  async function capacites(): Promise<CapacitesPont> {
    const volume = await adaptateurs.volume.capacites().catch(() => ({ disponible: false }));
    const lanceur = await adaptateurs.lanceur
      .capacites()
      .catch(() => ({ listerApplications: false, ouvrirComposeur: false }));
    return {
      appelerContact: lanceur.ouvrirComposeur,
      ouvrirApplication: lanceur.listerApplications,
      reglerVolume: volume.disponible,
      prendrePhoto: true,
    };
  }

  /**
   * Prépare un appel — et ne l'émet JAMAIS.
   *
   * Trois sûretés se rejoignent ici :
   * 1. Sur homonymes, `apparier` rend `ambigue` et PASS DEMANDE. Choisir le
   *    premier « Awa » de la liste, c'est appeler la mauvaise personne.
   * 2. Le numéro trouvé ouvre le COMPOSEUR pré-rempli : c'est la personne qui
   *    appuie. Rien de sensible ne part en silence.
   * 3. D'où l'absence de `CALL_PHONE` dans le manifeste.
   */
  async function appelerContact(entree: AppelerContact): Promise<ResultatAction> {
    return sansEclat(async () => {
      if (!(await adaptateurs.contacts.permission())) return REFUS_CONTACTS;

      const trouve = apparier(entree.nom, await adaptateurs.contacts.lister());
      if (trouve.statut === "aucune") {
        return {
          ok: false,
          message: `Je ne trouve personne du nom de ${entree.nom} dans vos contacts.`,
          code: "introuvable",
        };
      }
      if (trouve.statut === "ambigue") {
        const noms = [...new Set(trouve.candidats.map((c) => c.libelle))];
        return {
          ok: false,
          message:
            noms.length > 1
              ? `Plusieurs personnes correspondent : ${noms.join(", ")}. Laquelle voulez-vous appeler ?`
              : `${noms[0]} a plusieurs numéros. Lequel voulez-vous appeler ?`,
          code: "introuvable",
          detail: `${trouve.candidats.length} candidats`,
        };
      }

      const reponse = await adaptateurs.lanceur.ouvrirComposeur({ numero: trouve.candidat.valeur });
      return depuisGreffon(
        reponse,
        `J'ouvre le composeur pour ${trouve.candidat.libelle}. Appuyez pour lancer l'appel.`,
      );
    });
  }

  async function ouvrirApplication(entree: OuvrirApplication): Promise<ResultatAction> {
    return sansEclat(async () => {
      const { applications } = await adaptateurs.lanceur.listerApplications();
      const trouve = apparier(
        entree.application,
        applications.map((a) => ({ libelle: a.libelle, valeur: a.paquet })),
      );
      if (trouve.statut === "aucune") {
        return {
          ok: false,
          message: `Je ne trouve pas l'application ${entree.application} sur ce téléphone.`,
          code: "introuvable",
        };
      }
      if (trouve.statut === "ambigue") {
        const noms = trouve.candidats.map((c) => c.libelle).slice(0, 4);
        return {
          ok: false,
          message: `Plusieurs applications correspondent : ${noms.join(", ")}. Laquelle ?`,
          code: "introuvable",
          detail: `${trouve.candidats.length} candidats`,
        };
      }
      const reponse = await adaptateurs.lanceur.ouvrirPaquet({ paquet: trouve.candidat.valeur });
      return depuisGreffon(reponse, `J'ouvre ${trouve.candidat.libelle}.`);
    });
  }

  async function reglerVolume(entree: ReglerVolume): Promise<ResultatAction> {
    return sansEclat(async () =>
      depuisGreffon(await adaptateurs.volume.reglerVolume(entree), "C'est fait."),
    );
  }

  async function prendrePhoto(entree: PrendrePhoto): Promise<ResultatAction> {
    return sansEclat(async () => {
      if (!(await adaptateurs.camera.permission())) return REFUS_CAMERA;
      const media = await adaptateurs.camera.prendre(entree);
      return { ok: true, message: "La photo est prise.", detail: media.uri ?? "" };
    });
  }

  return { capacites, appelerContact, ouvrirApplication, reglerVolume, prendrePhoto };
}
