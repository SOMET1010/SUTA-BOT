import { describe, expect, it } from "vitest";
import { detecterGesteAssistance, detecterIntentionPass } from "../src/intentions";
import { normaliser } from "../src/langue";

describe("normalisation", () => {
  it("ramène les lettres mandingues à l'ASCII (ce que NFD ne fait pas)", () => {
    expect(normaliser("yɛlɛ")).toBe("yele");
    expect(normaliser("dɔgɔya")).toBe("dogoya");
    expect(normaliser("dɛmɛ")).toBe("deme");
    expect(normaliser("ɲɔgɔn")).toBe("nyogon");
  });

  it("retire les tons à la française sans casser le mot", () => {
    expect(normaliser("Téléphone")).toBe("telephone");
    expect(normaliser("à")).toBe("a");
  });

  it("transforme la ponctuation en espace pour préserver les frontières de mot", () => {
    expect(normaliser("appelle-moi Awa")).toBe("appelle moi awa");
  });
});

describe("les cinq intentions, en français", () => {
  const cas: [string, string][] = [
    ["appelle Awa", "appeler_contact"],
    ["téléphone à ma sœur", "appeler_contact"],
    ["rappelle Kouassi s'il te plaît", "appeler_contact"],
    ["ouvre WhatsApp", "ouvrir_application"],
    ["lance la galerie", "ouvrir_application"],
    ["monte le son", "regler_volume"],
    ["baisse le volume", "regler_volume"],
    ["mets le téléphone en silencieux", "regler_volume"],
    ["c'est trop fort", "regler_volume"],
    ["prends une photo", "prendre_photo"],
    ["fais un selfie", "prendre_photo"],
    ["aide-moi", "assistance"],
    ["répète", "assistance"],
    ["stop", "assistance"],
  ];
  it.each(cas)("« %s » → %s", (commande, attendu) => {
    expect(detecterIntentionPass(commande)).toBe(attendu);
  });
});

describe("l'ordre des tests EST la spécification", () => {
  it("1. appeler AVANT assistance — « aide-moi à appeler Awa » demande un appel", () => {
    expect(detecterIntentionPass("aide-moi à appeler Awa")).toBe("appeler_contact");
  });

  it("2. ouvrir AVANT photo — « ouvre l'appareil photo » lance une application", () => {
    expect(detecterIntentionPass("ouvre l'appareil photo")).toBe("ouvrir_application");
    // et le contre-exemple : sans verbe de lancement, c'est bien une prise de vue
    expect(detecterIntentionPass("prends une photo")).toBe("prendre_photo");
  });

  it("3. volume AVANT assistance — « coupe le son » est un réglage, pas un arrêt", () => {
    expect(detecterIntentionPass("coupe le son")).toBe("regler_volume");
    // et « coupe » seul reste un arrêt
    expect(detecterIntentionPass("coupe")).toBe("assistance");
  });
});

describe("le défaut n'agit jamais", () => {
  const horsPerimetre = [
    "quel temps fait-il à Abidjan",
    "qui est le président",
    "combien coûte le sac de riz",
    "bonjour",
    "",
    "   ",
  ];
  it.each(horsPerimetre)("« %s » ne déclenche rien", (commande) => {
    expect(detecterIntentionPass(commande)).toBe("hors_perimetre");
  });
});

describe("dioula", () => {
  it("reconnaît les commandes dioula quand la session est en dioula", () => {
    expect(detecterIntentionPass("Awa wele", "dyu")).toBe("appeler_contact");
    expect(detecterIntentionPass("WhatsApp yɛlɛ", "dyu")).toBe("ouvrir_application");
    expect(detecterIntentionPass("mankan bonya", "dyu")).toBe("regler_volume");
    expect(detecterIntentionPass("foto ta", "dyu")).toBe("prendre_photo");
    expect(detecterIntentionPass("dɛmɛ", "dyu")).toBe("assistance");
  });

  it("accepte l'alternance codique : le français marche aussi en session dioula", () => {
    expect(detecterIntentionPass("prends une photo", "dyu")).toBe("prendre_photo");
    expect(detecterIntentionPass("appelle Awa", "dyu")).toBe("appeler_contact");
  });

  it("n'applique PAS les motifs dioula en session française (collisions de mots courts)", () => {
    expect(detecterIntentionPass("Awa wele", "fr")).toBe("hors_perimetre");
    expect(detecterIntentionPass("mankan bonya", "fr")).toBe("hors_perimetre");
  });
});

describe("les trois gestes d'assistance", () => {
  it("arrêter est testé en premier : quand ça doit s'arrêter, le reste attend", () => {
    expect(detecterGesteAssistance("stop")).toBe("arreter");
    expect(detecterGesteAssistance("arrête, aide-moi")).toBe("arreter");
  });

  it("répéter et aide", () => {
    expect(detecterGesteAssistance("répète")).toBe("repeter");
    expect(detecterGesteAssistance("aide-moi")).toBe("aide");
  });

  it("rend null hors assistance", () => {
    expect(detecterGesteAssistance("prends une photo")).toBeNull();
  });
});
