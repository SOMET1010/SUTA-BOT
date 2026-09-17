import { describe, expect, it } from "vitest";
import { executerAction, resoudreAction, type CapacitesPont } from "@suta/pass";
import { codeDepuisErreur } from "@/lib/bridge/pont";
import { creerPontSimule } from "@/lib/bridge/mock";

/**
 * Le pont, éprouvé au banc.
 *
 * Ces tests n'exercent PAS une imitation du pont : `creerPont` est le même
 * code que sur le téléphone, seuls les quatre adaptateurs sont simulés
 * (cf. `adaptateurs.ts`). Ce qui reste à vérifier sur terminal se réduit donc
 * aux adaptateurs eux-mêmes — pas aux décisions.
 */

const TOUT: CapacitesPont = {
  appelerContact: true,
  ouvrirApplication: true,
  reglerVolume: true,
  prendrePhoto: true,
};

describe("capacités", () => {
  it("un greffon absent se déclare, pour que PASS dise non AVANT d'essayer", async () => {
    const { pont } = creerPontSimule({ volumeDisponible: false, lanceurDisponible: false });
    expect(await pont.capacites()).toEqual({
      appelerContact: false,
      ouvrirApplication: false,
      reglerVolume: false,
      prendrePhoto: true,
    });
  });

  it("un greffon qui explose ne fait pas tomber la lecture des capacités", async () => {
    const { pont } = creerPontSimule();
    // Le simulateur rend des capacités normales ; la garde `.catch` est
    // vérifiée par le cas ci-dessus, celui-ci fixe le comportement nominal.
    expect(await pont.capacites()).toEqual(TOUT);
  });
});

describe("préparer un appel — la sûreté avant tout", () => {
  it("un homonyme n'est JAMAIS choisi, et le composeur n'est PAS ouvert", async () => {
    const { pont, journal } = creerPontSimule();
    const resultat = await pont.appelerContact({ nom: "Yao" });

    expect(resultat.ok).toBe(false);
    expect(resultat.code).toBe("introuvable");
    expect(resultat.message).toMatch(/plusieurs numéros/i);
    // LA garantie : rien n'a été composé.
    expect(journal.filter((l) => l.startsWith("ouvrirComposeur"))).toHaveLength(0);
  });

  it("deux personnes différentes : les deux noms sont proposés, aucun choisi", async () => {
    const { pont, journal } = creerPontSimule({
      contacts: [
        { libelle: "Awa Koné", valeur: "+2250700000001" },
        { libelle: "Awa Traoré", valeur: "+2250700000002" },
      ],
    });
    const resultat = await pont.appelerContact({ nom: "Awa" });
    expect(resultat.message).toContain("Awa Koné");
    expect(resultat.message).toContain("Awa Traoré");
    expect(journal.some((l) => l.startsWith("ouvrirComposeur"))).toBe(false);
  });

  it("un contact unique ouvre le COMPOSEUR — l'appel n'est pas émis", async () => {
    const { pont, journal } = creerPontSimule();
    const resultat = await pont.appelerContact({ nom: "Kouassi" });

    expect(resultat.ok).toBe(true);
    expect(journal).toContain("ouvrirComposeur:+2250700000003");
    // Le message dit explicitement que la personne garde la main.
    expect(resultat.message).toMatch(/appuyez/i);
  });

  it("un contact absent rend introuvable, sans rien tenter", async () => {
    const { pont, journal } = creerPontSimule();
    const resultat = await pont.appelerContact({ nom: "Zoumana" });
    expect(resultat.code).toBe("introuvable");
    expect(journal.some((l) => l.startsWith("ouvrirComposeur"))).toBe(false);
  });

  it("un refus de permission est un RÉSULTAT explicite, et le carnet n'est pas lu", async () => {
    const { pont, journal } = creerPontSimule({ permissionContacts: false });
    const resultat = await pont.appelerContact({ nom: "Awa" });

    expect(resultat.ok).toBe(false);
    expect(resultat.code).toBe("permission_refusee");
    expect(resultat.message).toMatch(/réglages/i);
    expect(journal).not.toContain("listerContacts");
  });
});

describe("ouvrir une application", () => {
  it("ouvre le bon paquet", async () => {
    const { pont, journal } = creerPontSimule();
    const resultat = await pont.ouvrirApplication({ application: "WhatsApp" });
    expect(resultat.ok).toBe(true);
    expect(journal).toContain("ouvrirPaquet:com.whatsapp");
  });

  it("une application absente rend introuvable", async () => {
    const { pont } = creerPontSimule();
    const resultat = await pont.ouvrirApplication({ application: "Photoshop" });
    expect(resultat.code).toBe("introuvable");
  });

  it("l'ambiguïté vaut aussi pour les applications : aucun paquet n'est lancé", async () => {
    const { pont, journal } = creerPontSimule({
      applications: [
        { libelle: "Orange Money", paquet: "com.orange.money.ci" },
        { libelle: "Orange Max It", paquet: "com.orange.maxit" },
      ],
    });
    const resultat = await pont.ouvrirApplication({ application: "Orange" });
    expect(resultat.code).toBe("introuvable");
    expect(journal.some((l) => l.startsWith("ouvrirPaquet"))).toBe(false);
  });
});

describe("volume", () => {
  it("les quatre sens descendent tels quels au greffon", async () => {
    const { pont, journal, volume } = creerPontSimule();
    await pont.reglerVolume({ sens: "monter" });
    await pont.reglerVolume({ sens: "baisser" });
    await pont.reglerVolume({ sens: "couper" });
    await pont.reglerVolume({ sens: "definir", niveau: 30 });
    expect(journal).toEqual(["volume:monter", "volume:baisser", "volume:couper", "volume:definir:30"]);
    expect(volume()).toEqual({ sens: "definir", niveau: 30 });
  });
});

describe("photo", () => {
  it("transmet la caméra demandée", async () => {
    const { pont, journal } = creerPontSimule();
    await pont.prendrePhoto({ camera: "avant" });
    expect(journal).toContain("prendrePhoto:avant");
  });

  it("un refus de permission n'ouvre pas l'appareil", async () => {
    const { pont, journal } = creerPontSimule({ permissionCamera: false });
    const resultat = await pont.prendrePhoto({ camera: "arriere" });
    expect(resultat.code).toBe("permission_refusee");
    expect(journal.some((l) => l.startsWith("prendrePhoto"))).toBe(false);
  });

  it("une exception du greffon est CONTENUE : un résultat, jamais un éclat", async () => {
    const { pont } = creerPontSimule({ erreurCamera: new Error("User cancelled photos app") });
    const resultat = await pont.prendrePhoto({ camera: "arriere" });
    expect(resultat.ok).toBe(false);
    expect(resultat.code).toBe("annule_par_utilisateur");
  });

  it("une exception inattendue devient erreur_interne, détail journalisé jamais énoncé", async () => {
    const { pont } = creerPontSimule({ erreurCamera: new Error("java.lang.IllegalStateException") });
    const resultat = await pont.prendrePhoto({ camera: "arriere" });
    expect(resultat.code).toBe("erreur_interne");
    expect(resultat.message).toBe("");
    expect(resultat.detail).toContain("IllegalStateException");
  });
});

describe("traduction des erreurs de greffon", () => {
  it("reconnaît annulation, refus et non-support ; retombe sur erreur_interne", () => {
    expect(codeDepuisErreur(new Error("User cancelled photos app"))).toBe("annule_par_utilisateur");
    expect(codeDepuisErreur(new Error("User denied access to camera"))).toBe("permission_refusee");
    expect(codeDepuisErreur(new Error("Plugin not implemented on web"))).toBe("non_supporte");
    expect(codeDepuisErreur(new Error("boom"))).toBe("erreur_interne");
    expect(codeDepuisErreur("une chaîne nue")).toBe("erreur_interne");
  });
});

describe("la chaîne complète : commande → @suta/pass → pont → résultat", () => {
  it("« ouvre WhatsApp » va du texte au paquet Android", async () => {
    const { pont, journal } = creerPontSimule();
    const resolution = resoudreAction("ouvre WhatsApp");
    expect(resolution.statut).toBe("prete");
    if (resolution.statut !== "prete") return;

    const resultat = await executerAction(pont, resolution.action, TOUT);
    expect(resultat.ok).toBe(true);
    expect(journal).toContain("ouvrirPaquet:com.whatsapp");
  });

  it("« mets le volume à 30 » traverse le routage jusqu'au greffon", async () => {
    const { pont, volume } = creerPontSimule();
    const resolution = resoudreAction("mets le volume à 30");
    expect(resolution.statut).toBe("prete");
    if (resolution.statut !== "prete") return;

    await executerAction(pont, resolution.action, TOUT);
    expect(volume()).toEqual({ sens: "definir", niveau: 30 });
  });

  it("« assistance » ne descend jamais au pont", async () => {
    const { pont, journal } = creerPontSimule();
    const resolution = resoudreAction("aide-moi");
    expect(resolution.statut).toBe("prete");
    if (resolution.statut !== "prete") return;

    await executerAction(pont, resolution.action, TOUT);
    expect(journal).toEqual([]);
  });

  it("une capacité absente arrête l'action AVANT le greffon", async () => {
    const { pont, journal } = creerPontSimule();
    const resultat = await executerAction(
      pont,
      { nom: "prendre_photo", entree: { camera: "arriere" } },
      { ...TOUT, prendrePhoto: false },
    );
    expect(resultat.code).toBe("non_supporte");
    expect(journal).toEqual([]);
  });
});
