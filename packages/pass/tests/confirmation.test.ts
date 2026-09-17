import { describe, expect, it } from "vitest";
import type { ActionPass } from "../src/actions";
import { resoudreAction } from "../src/actions";
import {
  annonce,
  demandeConfirmation,
  exigeConfirmation,
  messageRefus,
  messageResultat,
} from "../src/confirmation";

const APPEL: ActionPass = { nom: "appeler_contact", entree: { nom: "Awa" } };
const PHOTO: ActionPass = { nom: "prendre_photo", entree: { camera: "arriere" } };

describe("confirmation avant d'agir", () => {
  it("l'appel est la SEULE action qui demande l'accord", () => {
    expect(exigeConfirmation(APPEL)).toBe(true);
    expect(exigeConfirmation(PHOTO)).toBe(false);
    expect(exigeConfirmation({ nom: "regler_volume", entree: { sens: "couper" } })).toBe(false);
    expect(exigeConfirmation({ nom: "ouvrir_application", entree: { application: "whatsapp" } })).toBe(false);
    expect(exigeConfirmation({ nom: "assistance", entree: { geste: "aide" } })).toBe(false);
  });

  it("la question nomme la personne appelée", () => {
    expect(demandeConfirmation(APPEL)?.texte).toBe("Voulez-vous que j'appelle Awa ?");
  });

  it("aucune question pour les actions réversibles", () => {
    expect(demandeConfirmation(PHOTO)).toBeNull();
  });
});

describe("annonces", () => {
  it("chaque action a une phrase, et les quatre sens du volume diffèrent", () => {
    expect(annonce(APPEL).texte).toBe("J'appelle Awa.");
    expect(annonce({ nom: "ouvrir_application", entree: { application: "whatsapp" } }).texte).toBe(
      "J'ouvre whatsapp.",
    );
    const sens = (["monter", "baisser", "couper"] as const).map(
      (s) => annonce({ nom: "regler_volume", entree: { sens: s } }).texte,
    );
    expect(new Set(sens).size).toBe(3);
    expect(annonce({ nom: "regler_volume", entree: { sens: "definir", niveau: 40 } }).texte).toContain("40");
    expect(annonce(PHOTO).texte).toBe("Je prends la photo.");
  });

  it("l'aide énumère ce que PASS sait faire", () => {
    const texte = annonce({ nom: "assistance", entree: { geste: "aide" } }).texte;
    for (const attendu of [/appeler/i, /application/i, /son/i, /photo/i]) {
      expect(texte).toMatch(attendu);
    }
  });
});

describe("le repli vers le français est explicite, jamais silencieux", () => {
  it("en français, la phrase est marquée traduite", () => {
    const p = annonce(PHOTO, "fr");
    expect(p).toMatchObject({ langue: "fr", traduite: true });
  });

  it("en dioula, faute de formulation validée, le repli est SIGNALÉ", () => {
    const p = annonce(PHOTO, "dyu");
    expect(p.traduite).toBe(false);
    expect(p.langue).toBe("fr");
  });

  it("le repli vaut aussi pour la confirmation et le refus", () => {
    expect(demandeConfirmation(APPEL, "dyu")?.traduite).toBe(false);
    expect(messageRefus("dyu").traduite).toBe(false);
  });
});

describe("messages de résultat", () => {
  it("un échec sans phrase propre retombe sur le message du code", () => {
    expect(messageResultat({ ok: false, message: "", code: "introuvable" }).texte).toMatch(/trouve pas/i);
    expect(messageResultat({ ok: false, message: "" }).texte).toMatch(/réessayer/i);
  });

  it("la phrase du pont prime quand elle existe", () => {
    expect(
      messageResultat({ ok: false, message: "Awa n'est pas dans vos contacts.", code: "introuvable" }).texte,
    ).toBe("Awa n'est pas dans vos contacts.");
  });

  it("le détail technique n'est jamais énoncé", () => {
    const p = messageResultat({
      ok: false,
      message: "",
      code: "erreur_interne",
      detail: "SecurityException: CALL_PHONE",
    });
    expect(p.texte).not.toContain("SecurityException");
  });
});

describe("la chaîne complète : parole → action → phrase", () => {
  it("« appelle Awa » demande confirmation avant d'agir", () => {
    const r = resoudreAction("appelle Awa");
    expect(r.statut).toBe("prete");
    if (r.statut !== "prete") return;
    expect(exigeConfirmation(r.action)).toBe(true);
    expect(demandeConfirmation(r.action)?.texte).toContain("awa");
  });

  it("« prends une photo » agit sans demander", () => {
    const r = resoudreAction("prends une photo");
    expect(r.statut).toBe("prete");
    if (r.statut !== "prete") return;
    expect(demandeConfirmation(r.action)).toBeNull();
    expect(annonce(r.action).texte).toBe("Je prends la photo.");
  });
});
