import { describe, expect, it } from "vitest";

import { SentenceStream } from "@/lib/voice/sentence-stream";

describe("SentenceStream — découpe le texte du cerveau en phrases prononçables", () => {
  it("émet chaque phrase dès que sa clôture arrive, sans attendre la fin", () => {
    const s = new SentenceStream();
    expect(s.push("Le PASS, c'est un smartphone subventionné. ")).toEqual([
      "Le PASS, c'est un smartphone subventionné.",
    ]);
    expect(s.push("Il est en préparation. Les détails")).toEqual(["Il est en préparation."]);
    expect(s.flush()).toBe("Les détails");
  });

  it("recolle une phrase coupée en plein milieu par les deltas", () => {
    const s = new SentenceStream();
    expect(s.push("Bonjour, je suis SUTA, l'assis")).toEqual([]);
    expect(s.push("tant de l'ANSUT. On est ensemble. ")).toEqual([
      "Bonjour, je suis SUTA, l'assistant de l'ANSUT.",
      "On est ensemble.",
    ]);
    expect(s.flush()).toBeNull();
  });

  it("un point suivi de texte sans blanc ne coupe pas (9.900, 2.5)", () => {
    const s = new SentenceStream();
    expect(s.push("Le modèle coûte 9.900 francs CFA. ")).toEqual(["Le modèle coûte 9.900 francs CFA."]);
  });

  it("le saut de ligne clôt une phrase même sans ponctuation", () => {
    const s = new SentenceStream();
    expect(s.push("Premier paragraphe\n\nDeuxième point. ")).toEqual([
      "Premier paragraphe",
      "Deuxième point.",
    ]);
  });

  it("les clôtures fortes ! ? … sont reconnues, guillemets fermants compris", () => {
    const s = new SentenceStream();
    expect(s.push("On est ensemble ! Vous voulez en savoir plus ? Dites « oui ». Voilà")).toEqual([
      "On est ensemble !",
      "Vous voulez en savoir plus ?",
      "Dites « oui ».",
    ]);
    expect(s.flush()).toBe("Voilà");
  });

  it("un fragment trop court n'est jamais prononcé seul", () => {
    const s = new SentenceStream();
    // « M. » ne part pas seul : il reste collé à la phrase qu'il commence.
    expect(s.push("M. ")).toEqual([]);
    expect(s.push("Beugre vous répond. ")).toEqual(["M. Beugre vous répond."]);
  });

  it("flush vide rend null, et le tampon repart à zéro", () => {
    const s = new SentenceStream();
    expect(s.flush()).toBeNull();
    s.push("Une phrase entière. ");
    expect(s.flush()).toBeNull();
  });
});
