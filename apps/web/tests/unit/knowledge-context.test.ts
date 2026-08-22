import { describe, expect, it } from "vitest";
import { CONSIGNE_SYNTHESE, shapeKnowledgeForModel } from "@/lib/realtime/knowledge-context";

describe("shapeKnowledgeForModel", () => {
  it("présente les contenus comme des preuves à synthétiser, pas à réciter", () => {
    const shaped = shapeKnowledgeForModel({
      results: [
        { title: "Localité — DJACE", content: "Village de DJACE, électrifié.", score: 0.6 },
        { title: "BTS — Jacqueville", content: "BTS en service.", score: 0.5 },
      ],
    }) as { preuves: string[]; consigne: string };

    expect(shaped.preuves).toEqual(["Village de DJACE, électrifié.", "BTS en service."]);
    expect(shaped.consigne).toBe(CONSIGNE_SYNTHESE);
    // La consigne porte la règle citoyenne : intention d'abord, brièveté,
    // détails proposés ensuite — pas de récitation.
    expect(shaped.consigne).toContain("ne les récite jamais");
    expect(shaped.consigne).toContain("une à trois phrases");
    expect(shaped.consigne).toContain("propose d'en dire plus");
  });

  it("limite le nombre de preuves : trop de fiches nourrit l'inventaire", () => {
    const shaped = shapeKnowledgeForModel({
      results: Array.from({ length: 8 }, (_, i) => ({ content: `Fiche ${i}` })),
    }) as { preuves: string[] };
    expect(shaped.preuves.length).toBeLessThanOrEqual(3);
  });

  it("ignore les résultats sans contenu textuel", () => {
    const shaped = shapeKnowledgeForModel({
      results: [{ content: 42 }, { content: "Seul contenu valide." }, {}],
    }) as { preuves: string[] };
    expect(shaped.preuves).toEqual(["Seul contenu valide."]);
  });

  it("laisse passer les erreurs d'outil telles quelles", () => {
    // Le modèle doit recevoir l'échec pour dire honnêtement qu'il n'a pas
    // trouvé, au lieu d'une liste de preuves vide qui l'invite à broder.
    expect(shapeKnowledgeForModel({ error: "indisponible" })).toEqual({ error: "indisponible" });
    expect(shapeKnowledgeForModel(null)).toBeNull();
  });
});
