import { describe, expect, it } from "vitest";
import { detecterIntention, familleDeLieuPreferee } from "@/lib/realtime/intentions";

/**
 * VAGUE 3 — le routage d'intention. Chaque cas ci-dessous est une question
 * réellement posée (recettes DTDI, terrain, contre-audit, banc vocal) : ce
 * fichier est la mémoire des leçons, l'ordre de détection ne doit jamais les
 * reperdre silencieusement.
 */
describe("detecterIntention — les leçons de terrain", () => {
  it("« mon village est-il connecté ? » demande la couverture", () => {
    expect(detecterIntention("Mon village de Katiola est-il connecté à la fibre ?")).toBe("couverture");
    expect(detecterIntention("mon village moossou est il dans une zone blanche")).toBe("couverture");
    expect(detecterIntention("À quelle distance est la fibre de Bouaké ?")).toBe("couverture");
  });

  it("« quels opérateurs ? » demande les opérateurs, même avec « couvrent »", () => {
    // Contre-audit du 01/09 : la question contient « couvrent » mais demande
    // les opérateurs — l'ancien tri servait la fiche Localité.
    expect(detecterIntention("Quels opérateurs mobiles couvrent Korhogo ?")).toBe("operateurs");
    expect(detecterIntention("Y a-t-il un site MTN près de Korhogo ?")).toBe("operateurs");
    expect(detecterIntention("Quelle est la couverture Orange à Daloa ?")).toBe("operateurs");
  });

  it("« se former au smartphone » est une demande de FORMATION (cas Elvire, 02/09)", () => {
    expect(
      detecterIntention("ma tante a satamasokoro et elle ne parle que le dioula est qu'il y a des initiatives pour qu elle se forme à l utilisation de son smartphone"),
    ).toBe("formation");
    expect(detecterIntention("Où puis-je apprendre à utiliser un ordinateur ?")).toBe("formation");
  });

  it("s'équiper et le PASS relèvent de l'équipement", () => {
    expect(detecterIntention("Comment puis-je m'équiper ?")).toBe("equipement");
    expect(detecterIntention("Ai-je droit au PASS ?")).toBe("equipement");
  });

  it("le PTBA et les projets relèvent des projets", () => {
    expect(detecterIntention("Que prévoit le PTBA ?")).toBe("projets");
    expect(detecterIntention("Quels sont les projets de l'ANSUT pour 2026 ?")).toBe("projets");
  });

  it("hors domaine : météo, politique, sport — même avec un nom de ville", () => {
    // Contre-audit du 01/09 : un nom de lieu suffisait à franchir le plancher.
    expect(detecterIntention("Quel temps fait-il à Abidjan ?")).toBe("hors_domaine");
    expect(detecterIntention("Qui est le président de la Côte d'Ivoire ?")).toBe("hors_domaine");
    expect(detecterIntention("Quelle est la capitale de la France ?")).toBe("hors_domaine");
  });

  it("le lexique du domaine protège du classement hors domaine", () => {
    // Une vraie question ANSUT n'est jamais éjectée par un mot de contexte.
    expect(detecterIntention("Y a-t-il du réseau au stade pendant le match de football ?")).not.toBe("hors_domaine");
  });

  it("le charabia et les demandes sans rapport restent « générale » (zéro preuve en aval)", () => {
    expect(detecterIntention("xyzabc kdjfhskdjfh")).toBe("generale");
    expect(detecterIntention("je veux la recette du foutou")).toBe("generale");
  });
});

describe("familleDeLieuPreferee — la fiche que l'intention appelle", () => {
  it("opérateurs → fiche Opérateurs mobiles ; couverture → fiche Localité", () => {
    expect(familleDeLieuPreferee("operateurs")?.test("Opérateurs mobiles — Korhogo (Korhogo)")).toBe(true);
    expect(familleDeLieuPreferee("couverture")?.test("Localité — KORHOGO (KORHOGO)")).toBe(true);
    expect(familleDeLieuPreferee("couverture")?.test("Opérateurs mobiles — Korhogo (Korhogo)")).toBe(false);
  });

  it("les autres intentions n'imposent aucune fiche de lieu", () => {
    expect(familleDeLieuPreferee("formation")).toBeNull();
    expect(familleDeLieuPreferee("generale")).toBeNull();
  });
});
