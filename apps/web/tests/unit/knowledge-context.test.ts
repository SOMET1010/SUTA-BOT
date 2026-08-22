import { describe, expect, it } from "vitest";
import {
  CONSIGNE_INSUFFISANTE,
  CONSIGNE_SYNTHESE,
  selectionnerPreuves,
  shapeKnowledgeForModel,
} from "@/lib/realtime/knowledge-context";

/** Fixtures tirées du corpus réel (extraits verbatim de la base). */
const FICHE_DJACE = {
  title: "Localité — DJACE (JACQUEVILLE)",
  content:
    "Village de DJACE, sous-préfecture de JACQUEVILLE, département de JACQUEVILLE, " +
    "région GRANDS-PONTS. Population : 371 habitants. Électrification : OUI. " +
    "Distances aux infrastructures : site 3G le plus proche 613 m.",
  score: 0.611,
};
const FICHE_AUTRE_VILLAGE = {
  title: "Localité — VAPLEU (ZOUAN-HOUNIEN)",
  content: "Village de VAPLEU, sous-préfecture de ZOUAN-HOUNIEN. Population : 500 habitants.",
  score: 0.535,
};
const FICHE_METHODOLOGIQUE = {
  title: "Les localités dont on ne connaît pas la position exacte",
  content:
    "Or 434 localités du recensement, où vivent 316 306 personnes, n'ont pas de " +
    "coordonnées géographiques exploitables. Pour celles-là, la distance ne peut " +
    "pas être calculée. L'ANSUT a choisi de les compter comme non couvertes par précaution.",
  score: 0.62,
};
const FICHE_PASS = {
  title: "Le programme PASS : un smartphone à petit prix",
  content: "Le programme PASS permet d'acheter un smartphone à petit prix.",
  score: 0.6,
};

describe("selectionnerPreuves", () => {
  it("écarte la fiche méthodologique d'une question citoyenne concrète", () => {
    // Bug réel : « mon village est-il connecté ? » répondu par la fiche
    // « 434 localités sans coordonnées GPS ». Hors sujet.
    const preuves = selectionnerPreuves("mon village DJACE est-il connecté ?", {
      results: [FICHE_METHODOLOGIQUE, FICHE_DJACE],
    });
    expect(preuves).toEqual([FICHE_DJACE.content]);
  });

  it("garde la fiche méthodologique quand la question porte sur la méthode", () => {
    const preuves = selectionnerPreuves(
      "comment sont comptées les localités sans coordonnées ?",
      { results: [FICHE_METHODOLOGIQUE] },
    );
    expect(preuves).toEqual([FICHE_METHODOLOGIQUE.content]);
  });

  it("écarte la fiche d'un village que la question ne nomme pas", () => {
    // Sans toponyme, le classement vectoriel renvoie des villages au hasard :
    // décrire VAPLEU à quelqu'un qui n'en a jamais parlé est pire que
    // demander le nom du village.
    const preuves = selectionnerPreuves("mon village est-il connecté ?", {
      results: [FICHE_AUTRE_VILLAGE, FICHE_DJACE],
    });
    expect(preuves).toEqual([]);
  });

  it("garde la fiche du village nommé, dans n'importe quelle casse et accentuation", () => {
    const preuves = selectionnerPreuves("est-ce que Djacé a le réseau ?", {
      results: [FICHE_DJACE, FICHE_AUTRE_VILLAGE],
    });
    expect(preuves).toEqual([FICHE_DJACE.content]);
  });

  it("laisse passer les fiches non géographiques (programmes, démarches)", () => {
    const preuves = selectionnerPreuves("c'est quoi le programme PASS ?", {
      results: [FICHE_PASS],
    });
    expect(preuves).toEqual([FICHE_PASS.content]);
  });

  it("plafonne à trois preuves", () => {
    const preuves = selectionnerPreuves("le programme PASS", {
      results: Array.from({ length: 8 }, (_, i) => ({
        title: `Fiche PASS ${i}`,
        content: `Contenu ${i}`,
      })),
    });
    expect(preuves).toHaveLength(3);
  });
});

describe("shapeKnowledgeForModel", () => {
  it("présente les preuves retenues avec la consigne de synthèse", () => {
    const shaped = shapeKnowledgeForModel(
      { results: [FICHE_DJACE] },
      "mon village DJACE est-il connecté ?",
    ) as { preuves: string[]; consigne: string };
    expect(shaped.preuves).toEqual([FICHE_DJACE.content]);
    expect(shaped.consigne).toBe(CONSIGNE_SYNTHESE);
    expect(shaped.consigne).toContain("ne les récite jamais");
    expect(shaped.consigne).toContain("une à trois phrases");
  });

  it("dit au modèle qu'il n'a rien plutôt que de lui tendre un texte voisin", () => {
    const shaped = shapeKnowledgeForModel(
      { results: [FICHE_METHODOLOGIQUE, FICHE_AUTRE_VILLAGE] },
      "mon village est-il connecté ?",
    ) as { preuves: string[]; consigne: string };
    expect(shaped.preuves).toEqual([]);
    expect(shaped.consigne).toBe(CONSIGNE_INSUFFISANTE);
    expect(shaped.consigne).toContain("demande-le");
  });

  it("laisse passer les erreurs d'outil telles quelles", () => {
    expect(shapeKnowledgeForModel({ error: "indisponible" }, "peu importe")).toEqual({
      error: "indisponible",
    });
    expect(shapeKnowledgeForModel(null, "")).toBeNull();
  });
});
