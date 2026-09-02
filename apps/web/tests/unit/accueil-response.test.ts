import { describe, expect, it } from "vitest";
import { REPONSE_ACCUEIL, getAccueilResponse } from "@/lib/suta/accueil-response";

/**
 * Revue d'architecture du 03/09 — « le seul test qui aurait attrapé la
 * dernière régression » : les boutons de l'écran d'accueil, avec pour
 * assertion non pas « une réponse » mais « une réponse qui fait avancer ».
 * Mesuré sur les huit boutons réels : six mènent quelque part, deux
 * (demandes larges d'orientation) recevaient des fiches prospectives.
 */
describe("accueil — les demandes larges d'orientation", () => {
  it("les deux boutons qui échouaient reçoivent l'accueil qui oriente", () => {
    // Starter « Expliquez-moi simplement » (mesuré : fiches à 0,34-0,37).
    expect(getAccueilResponse("Pouvez-vous m'expliquer simplement ce qui peut être utile dans ma situation ?")).toBe(REPONSE_ACCUEIL);
    // Persona « Citoyen » du kiosque (mesuré : prose prospective à 0,51).
    expect(getAccueilResponse("Je suis un citoyen. Aide-moi à comprendre ce que les services publics peuvent faire concrètement pour moi.")).toBe(REPONSE_ACCUEIL);
  });

  it("les tournures orales voisines aussi", () => {
    expect(getAccueilResponse("que peux-tu faire ?")).toBe(REPONSE_ACCUEIL);
    expect(getAccueilResponse("à quoi tu sers ?")).toBe(REPONSE_ACCUEIL);
    expect(getAccueilResponse("je ne sais pas par où commencer")).toBe(REPONSE_ACCUEIL);
  });

  it("l'accueil dit quoi faire, pas qui il est : les quatre portes y sont", () => {
    expect(REPONSE_ACCUEIL).toContain("nom");
    expect(REPONSE_ACCUEIL).toContain("PASS");
    expect(REPONSE_ACCUEIL).toContain("formations");
    expect(REPONSE_ACCUEIL).toContain("signalement");
  });

  it("les six boutons qui marchaient ne tombent JAMAIS ici", () => {
    // Une question précise garde son chemin (recherche, Lot Action…).
    for (const prompt of [
      "Je voudrais savoir si mon village est connecté.",
      "Quels dispositifs peuvent m'aider à m'équiper ?",
      "Je voudrais trouver une formation numérique adaptée à ma situation.",
      "Je veux savoir si ma localité est connectée et ce que je peux y faire avec le numérique.",
      "Je suis entrepreneur. Quels dispositifs numériques publics peuvent être utiles à mon activité ?",
      "Je cherche des solutions pour aider ma famille à s'équiper et à se former au numérique.",
    ]) {
      expect(getAccueilResponse(prompt)).toBeNull();
    }
  });

  it("ni les questions factuelles ordinaires", () => {
    expect(getAccueilResponse("Katiola est-il connecté ?")).toBeNull();
    expect(getAccueilResponse("il n'y a pas de réseau chez moi")).toBeNull();
    expect(getAccueilResponse("ai-je droit au PASS ?")).toBeNull();
  });
});
