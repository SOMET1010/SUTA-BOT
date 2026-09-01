import { describe, expect, it } from "vitest";
import {
  composerConfirmationSignalement,
  composerPointConnecte,
  detecterPassPrecheck,
  detecterPointConnecte,
  detecterSignalement,
  REPONSE_PRECHECK_PASS,
} from "@/lib/suta/actions-citoyennes";

/** LOT ACTION (arbitrage Patrick du 02/09) — parcours du chemin texte. */
describe("detecterSignalement", () => {
  it.each([
    ["Il n'y a pas de réseau chez nous", "pas_de_reseau"],
    ["ça ne capte pas au village", "pas_de_reseau"],
    ["le réseau est instable ici", "reseau_instable"],
    ["plus d'internet depuis hier", "pas_internet"],
    ["je veux signaler un problème d'internet", "pas_internet"],
    ["je veux signaler que le réseau coupe", "reseau_instable"],
  ])("détecte « %s » → %s", (texte, attendu) => {
    expect(detecterSignalement(texte)).toBe(attendu);
  });

  it.each([
    "Mon village est-il connecté ?",
    "c'est quoi le RNHD ?",
    "le réseau national haut débit, c'est quoi ?",
  ])("laisse passer « %s »", (texte) => {
    expect(detecterSignalement(texte)).toBeNull();
  });
});

describe("detecterPointConnecte / detecterPassPrecheck", () => {
  it("reconnaît la recherche du point connecté", () => {
    expect(detecterPointConnecte("Où est-ce que ça capte près de chez moi ?")).toBe(true);
    expect(detecterPointConnecte("quel est le prochain point connecté ?")).toBe(true);
    expect(detecterPointConnecte("Mon village est-il connecté ?")).toBe(false);
  });

  it("reconnaît la pré-vérification PASS, sans promettre", () => {
    expect(detecterPassPrecheck("Suis-je éligible au PASS ?")).toBe(true);
    expect(detecterPassPrecheck("est-ce que j'ai droit au téléphone du PASS ?")).toBe(true);
    expect(detecterPassPrecheck("c'est quoi le PASS ?")).toBe(false);
    expect(REPONSE_PRECHECK_PASS).toContain("publics visés");
    expect(REPONSE_PRECHECK_PASS).toContain("annoncés par l'ANSUT");
  });
});

describe("composerConfirmationSignalement", () => {
  it("confirme et oriente vers le point couvert le plus proche", () => {
    const texte = composerConfirmationSignalement("Abayansi", {
      enregistre: true, localiteReconnue: "Abayansi", region: "Gbeke",
      pointProche: { nom: "Ouengre", distanceKm: 2.2 },
    });
    expect(texte).toContain("Abayansi");
    expect(texte).toContain("Ouengre");
    expect(texte).toContain("2,2 km");
  });

  it("reste honnête quand la localité n'est pas reconnue", () => {
    const texte = composerConfirmationSignalement("Xyzville", { enregistre: true, localiteReconnue: null });
    expect(texte).toContain("Xyzville");
    expect(texte).toContain("pas trouvé cette localité");
  });

  it("avoue l'échec d'enregistrement", () => {
    expect(composerConfirmationSignalement("Abayansi", {})).toContain("n'a pas pu être enregistré");
  });
});

describe("composerPointConnecte", () => {
  it("répond couverte sur place", () => {
    const texte = composerPointConnecte("Katiola", {
      trouve: true, localite: { nom: "Katiola" }, couverteSurPlace: true,
      points: [{ nom: "Katiola", distanceKm: 0 }, { nom: "Fronan", distanceKm: 7.2 }],
    });
    expect(texte).toContain("Katiola est couverte");
    expect(texte).toContain("Fronan");
  });

  it("oriente vers le plus proche quand la localité n'est pas couverte", () => {
    const texte = composerPointConnecte("Abayansi", {
      trouve: true, localite: { nom: "Abayansi" }, couverteSurPlace: false,
      points: [{ nom: "Ouengre", distanceKm: 2.2 }, { nom: "Goyerebo", distanceKm: 2.9 }],
    });
    expect(texte).toContain("Ouengre");
    expect(texte).toContain("2,2 km");
    expect(texte).toContain("signalement");
  });

  it("avoue quand la localité est inconnue", () => {
    expect(composerPointConnecte("Xyzville", { trouve: false })).toContain("pas trouvé");
  });
});
