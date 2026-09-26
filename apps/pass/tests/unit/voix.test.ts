import { describe, expect, it } from "vitest";
import { estFrancaise, filtrerFrancaises, verdictMoteur, type VoixTerminal } from "@/lib/voix";

const voix = (nom: string, langue: string, horsLigne: boolean): VoixTerminal => ({ nom, langue, horsLigne });

describe("reconnaissance d'une voix française", () => {
  it("accepte les déclarations normales", () => {
    for (const code of ["fr", "fr-FR", "fr-CA", "fr-BE", "fr-CI"]) {
      expect(estFrancaise(voix("v", code, true))).toBe(true);
    }
  });

  it("accepte le tiret bas des moteurs Android : `fr_FR` est du français", () => {
    expect(estFrancaise(voix("v", "fr_FR", true))).toBe(true);
    expect(estFrancaise(voix("v", "FR_fr", true))).toBe(true);
  });

  it("ne confond pas avec une autre langue dont le code commence par f ou fr", () => {
    for (const code of ["fry", "fy-NL", "fa-IR", "en-US"]) {
      expect(estFrancaise(voix("v", code, true))).toBe(false);
    }
  });
});

describe("verdict du moteur", () => {
  it("aucune voix lue : on ne conclut pas à l'absence, on dit qu'on n'a pas lu", () => {
    const v = verdictMoteur([]);
    expect(v.total).toBe(0);
    expect(v.conclusion).toContain("Aucune voix lue");
  });

  it("des voix, mais aucune française", () => {
    const v = verdictMoteur([voix("Alice", "en-US", true), voix("Bob", "es-ES", true)]);
    expect(v.francaises).toBe(0);
    expect(v.conclusion).toContain("Aucune voix française");
  });

  it("française mais distante : inutilisable pour PASS, et c'est dit", () => {
    const v = verdictMoteur([voix("Denise", "fr-FR", false)]);
    expect(v.francaises).toBe(1);
    expect(v.francaisesHorsLigne).toBe(0);
    expect(v.conclusion).toContain("AUCUNE hors ligne");
  });

  it("française et hors ligne : le filet existe", () => {
    const v = verdictMoteur([voix("Denise", "fr-FR", true), voix("Alice", "en-US", true)]);
    expect(v.francaisesHorsLigne).toBe(1);
    expect(v.conclusion).toContain("Le filet existe");
  });

  it("les codes rencontrés sont rendus bruts et dédoublonnés — une étiquette n'est pas une voix", () => {
    const v = verdictMoteur([
      voix("A", "fr-FR", true),
      voix("B", "fr-FR", true),
      voix("C", "fr-CI", true),
      voix("D", "en-US", true),
    ]);
    expect(v.codesRencontres).toEqual(["fr-CI", "fr-FR"]);
  });

  it("filtrerFrancaises ne garde que le français", () => {
    expect(filtrerFrancaises([voix("A", "fr-FR", true), voix("B", "en-US", true)]).map((x) => x.nom)).toEqual(["A"]);
  });
});
