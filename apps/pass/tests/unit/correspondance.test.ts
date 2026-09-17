import { describe, expect, it } from "vitest";
import { apparier, type Candidat } from "@/lib/bridge/correspondance";

const CONTACTS: Candidat[] = [
  { libelle: "Awa Koné", valeur: "+2250700000001" },
  { libelle: "Awa Traoré", valeur: "+2250700000002" },
  { libelle: "Awa", valeur: "+2250700000009" },
  { libelle: "Kouassi N'Guessan", valeur: "+2250700000003" },
  { libelle: "Mariam", valeur: "+2250700000004" },
  { libelle: "Mariam", valeur: "+2250700000004" },
  { libelle: "Yao", valeur: "+2250700000005" },
  { libelle: "Yao", valeur: "+2250700000006" },
];

describe("la règle des homonymes ne se négocie pas", () => {
  it("deux personnes, deux numéros → AMBIGUË, jamais la première", () => {
    const trouve = apparier("Awa Kon", CONTACTS);
    expect(trouve.statut).toBe("unique"); // « Awa Kon » ne préfixe qu'Awa Koné
    const large = apparier("Awa T", CONTACTS);
    expect(large.statut).toBe("unique");
    const ambigu = apparier("Aw", CONTACTS);
    expect(ambigu.statut).toBe("ambigue");
    if (ambigu.statut !== "ambigue") return;
    expect(ambigu.candidats).toHaveLength(3);
  });

  it("un même nom avec deux numéros est AMBIGU — appeler le mauvais est irrattrapable", () => {
    const trouve = apparier("Yao", CONTACTS);
    expect(trouve.statut).toBe("ambigue");
    if (trouve.statut !== "ambigue") return;
    expect(trouve.candidats.map((c) => c.valeur)).toEqual(["+2250700000005", "+2250700000006"]);
  });

  it("un doublon strict n'est PAS une ambiguïté : les deux chemins mènent au même appel", () => {
    const trouve = apparier("Mariam", CONTACTS);
    expect(trouve.statut).toBe("unique");
    if (trouve.statut !== "unique") return;
    expect(trouve.candidat.valeur).toBe("+2250700000004");
  });
});

describe("les trois passes, de la plus stricte à la plus tolérante", () => {
  it("une correspondance EXACTE n'est jamais noyée par les partielles", () => {
    // « Awa » existe exactement ; « Awa Koné » et « Awa Traoré » ne doivent
    // pas venir la concurrencer.
    const trouve = apparier("Awa", CONTACTS);
    expect(trouve.statut).toBe("unique");
    if (trouve.statut !== "unique") return;
    expect(trouve.candidat.valeur).toBe("+2250700000009");
  });

  it("le préfixe sert quand l'exact ne donne rien", () => {
    const trouve = apparier("Kouassi", CONTACTS);
    expect(trouve.statut).toBe("unique");
  });

  it("l'inclusion sert en dernier recours", () => {
    const trouve = apparier("Guessan", CONTACTS);
    expect(trouve.statut).toBe("unique");
    if (trouve.statut !== "unique") return;
    expect(trouve.candidat.libelle).toBe("Kouassi N'Guessan");
  });
});

describe("normalisation partagée avec @suta/pass", () => {
  it("la casse, les accents et l'apostrophe ne font pas échouer la recherche", () => {
    expect(apparier("KOUASSI N'GUESSAN", CONTACTS).statut).toBe("unique");
    expect(apparier("kouassi n guessan", CONTACTS).statut).toBe("unique");
  });

  it("une cible vide ne correspond à rien — surtout pas à tout", () => {
    expect(apparier("", CONTACTS)).toEqual({ statut: "aucune" });
    expect(apparier("   ", CONTACTS)).toEqual({ statut: "aucune" });
  });

  it("aucun candidat, aucune correspondance", () => {
    expect(apparier("Zoumana", CONTACTS)).toEqual({ statut: "aucune" });
    expect(apparier("Awa", [])).toEqual({ statut: "aucune" });
  });
});
