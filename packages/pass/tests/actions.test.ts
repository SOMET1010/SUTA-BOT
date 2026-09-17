import { describe, expect, it } from "vitest";
import {
  analyserVolume,
  decrireActionsPass,
  estNomActionPass,
  extraireApplication,
  extraireNomContact,
  NOMS_ACTIONS_PASS,
  resoudreAction,
  validerAction,
} from "../src/actions";
import { normaliser } from "../src/langue";

describe("descripteurs pour le moteur Realtime", () => {
  it("expose exactement les cinq actions de la première tranche", () => {
    expect(decrireActionsPass().map((d) => d.name)).toEqual([...NOMS_ACTIONS_PASS]);
  });

  it("chaque descripteur porte une description et un schéma JSON", () => {
    for (const d of decrireActionsPass()) {
      expect(d.description.length).toBeGreaterThan(20);
      expect(d.parameters).toHaveProperty("type", "object");
    }
  });

  it("reconnaît les noms d'action valides et rejette le reste", () => {
    expect(estNomActionPass("prendre_photo")).toBe(true);
    expect(estNomActionPass("search_knowledge")).toBe(false);
    expect(estNomActionPass("cockpit_interroger")).toBe(false);
    expect(estNomActionPass(42)).toBe(false);
  });
});

describe("validation d'un appel d'outil (chemin en ligne)", () => {
  it("accepte un appel bien formé", () => {
    const v = validerAction("appeler_contact", { nom: "Awa" });
    expect(v).toEqual({ ok: true, action: { nom: "appeler_contact", entree: { nom: "Awa" } } });
  });

  it("refuse une action inconnue — y compris un outil citoyen ou cockpit", () => {
    expect(validerAction("search_knowledge", {}).ok).toBe(false);
    expect(validerAction("cockpit_interroger", { acces: "indicateur" }).ok).toBe(false);
  });

  it("refuse une entrée malformée", () => {
    expect(validerAction("appeler_contact", { nom: "" }).ok).toBe(false);
    expect(validerAction("appeler_contact", {}).ok).toBe(false);
    expect(validerAction("regler_volume", { sens: "exploser" }).ok).toBe(false);
  });

  it("applique la cohérence sens/niveau du volume", () => {
    expect(validerAction("regler_volume", { sens: "definir" }).ok).toBe(false);
    expect(validerAction("regler_volume", { sens: "monter", niveau: 50 }).ok).toBe(false);
    expect(validerAction("regler_volume", { sens: "definir", niveau: 50 }).ok).toBe(true);
    expect(validerAction("regler_volume", { sens: "couper" }).ok).toBe(true);
  });

  it("borne le niveau à 0-100", () => {
    expect(validerAction("regler_volume", { sens: "definir", niveau: 150 }).ok).toBe(false);
    expect(validerAction("regler_volume", { sens: "definir", niveau: -1 }).ok).toBe(false);
  });

  it("applique la caméra arrière par défaut", () => {
    const v = validerAction("prendre_photo", {});
    expect(v.ok && v.action.nom === "prendre_photo" && v.action.entree.camera).toBe("arriere");
  });
});

describe("extraction de la cible (chemin hors ligne)", () => {
  it("lit à DROITE du verbe en français (SVO)", () => {
    expect(extraireNomContact("appelle Awa")).toBe("awa");
    expect(extraireNomContact("rappelle Kouassi s'il te plaît")).toBe("kouassi");
    expect(extraireNomContact("téléphone à ma sœur")).toBe("soeur");
    expect(extraireApplication("ouvre WhatsApp")).toBe("whatsapp");
    expect(extraireApplication("ouvre l'appareil photo")).toBe("appareil photo");
  });

  it("lit à GAUCHE du verbe en dioula (SOV)", () => {
    expect(extraireNomContact("Awa wele", "dyu")).toBe("awa");
    expect(extraireApplication("WhatsApp yɛlɛ", "dyu")).toBe("whatsapp");
  });

  it("rend null quand la cible manque", () => {
    expect(extraireNomContact("appelle")).toBeNull();
    expect(extraireApplication("ouvre")).toBeNull();
  });
});

describe("analyse du volume", () => {
  it("reconnaît les quatre sens", () => {
    expect(analyserVolume("monte le son")).toEqual({ sens: "monter" });
    expect(analyserVolume("baisse le volume")).toEqual({ sens: "baisser" });
    expect(analyserVolume("coupe le son")).toEqual({ sens: "couper" });
    expect(analyserVolume("mets le volume à 50")).toEqual({ sens: "definir", niveau: 50 });
  });

  it("« c'est trop fort » demande de baisser", () => {
    expect(analyserVolume("c'est trop fort")).toEqual({ sens: "baisser" });
  });

  it("un niveau explicite l'emporte sur le verbe", () => {
    expect(analyserVolume("monte le son à 80")).toEqual({ sens: "definir", niveau: 80 });
  });

  it("rend null quand le sens manque — PASS demandera au lieu de choisir", () => {
    expect(analyserVolume("le son")).toBeNull();
    expect(analyserVolume("le volume")).toBeNull();
  });

  it("reconnaît bonya et dɔgɔya en dioula", () => {
    expect(analyserVolume("mankan bonya", "dyu")).toEqual({ sens: "monter" });
    expect(analyserVolume("mankan dɔgɔya", "dyu")).toEqual({ sens: "baisser" });
  });
});

describe("résolution de bout en bout (hors ligne)", () => {
  it("produit une action prête quand tout est dit", () => {
    expect(resoudreAction("appelle Awa")).toEqual({
      statut: "prete",
      intention: "appeler_contact",
      action: { nom: "appeler_contact", entree: { nom: "awa" } },
    });
    expect(resoudreAction("prends une photo")).toEqual({
      statut: "prete",
      intention: "prendre_photo",
      action: { nom: "prendre_photo", entree: { camera: "arriere" } },
    });
  });

  it("demande une précision plutôt que de choisir à la place de la personne", () => {
    expect(resoudreAction("appelle")).toEqual({
      statut: "precision",
      intention: "appeler_contact",
      question: "Qui voulez-vous appeler ?",
    });
    expect(resoudreAction("le son")).toMatchObject({
      statut: "precision",
      intention: "regler_volume",
    });
  });

  it("refuse tout ce qui n'est pas du périmètre PASS", () => {
    expect(resoudreAction("quel temps fait-il")).toEqual({
      statut: "refusee",
      intention: "hors_perimetre",
    });
  });

  it("toute action produite passe la validation d'outil — invariant du contrat", () => {
    const commandes = [
      "appelle Awa",
      "ouvre WhatsApp",
      "monte le son",
      "coupe le son",
      "mets le volume à 30",
      "prends une photo",
      "aide-moi",
      "stop",
      "répète",
    ];
    for (const commande of commandes) {
      const r = resoudreAction(commande);
      expect(r.statut).toBe("prete");
      if (r.statut !== "prete") continue;
      const v = validerAction(r.action.nom, r.action.entree);
      expect(v.ok, `${commande} → ${JSON.stringify(r.action)}`).toBe(true);
    }
  });

  it("le libellé rendu est normalisé : la correspondance appartient au pont", () => {
    const r = resoudreAction("appelle AWA Koné");
    expect(r.statut).toBe("prete");
    if (r.statut !== "prete" || r.action.nom !== "appeler_contact") return;
    expect(r.action.entree.nom).toBe(normaliser(r.action.entree.nom));
  });
});
