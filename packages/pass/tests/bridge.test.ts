import { describe, expect, it, vi } from "vitest";
import type { ActionPass } from "../src/actions";
import { executerAction, type CapacitesPont, type PontNatif } from "../src/bridge";

const TOUT_DISPONIBLE: CapacitesPont = {
  appelerContact: true,
  ouvrirApplication: true,
  reglerVolume: true,
  prendrePhoto: true,
};

function pontSimule(): PontNatif & { appels: string[] } {
  const appels: string[] = [];
  const ok = (quoi: string) => async () => {
    appels.push(quoi);
    return { ok: true, message: "" };
  };
  return {
    appels,
    capacites: async () => TOUT_DISPONIBLE,
    appelerContact: ok("appelerContact"),
    ouvrirApplication: ok("ouvrirApplication"),
    reglerVolume: ok("reglerVolume"),
    prendrePhoto: ok("prendrePhoto"),
  };
}

describe("aiguillage vers le pont natif", () => {
  const cas: [ActionPass, string][] = [
    [{ nom: "appeler_contact", entree: { nom: "awa" } }, "appelerContact"],
    [{ nom: "ouvrir_application", entree: { application: "whatsapp" } }, "ouvrirApplication"],
    [{ nom: "regler_volume", entree: { sens: "couper" } }, "reglerVolume"],
    [{ nom: "prendre_photo", entree: { camera: "arriere" } }, "prendrePhoto"],
  ];

  it.each(cas)("%o appelle la bonne méthode", async (action, methode) => {
    const pont = pontSimule();
    const r = await executerAction(pont, action, TOUT_DISPONIBLE);
    expect(r.ok).toBe(true);
    expect(pont.appels).toEqual([methode]);
  });

  it("assistance ne descend JAMAIS au pont", async () => {
    const pont = pontSimule();
    const r = await executerAction(
      pont,
      { nom: "assistance", entree: { geste: "aide" } },
      TOUT_DISPONIBLE,
    );
    expect(pont.appels).toEqual([]);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("non_supporte");
  });
});

describe("capacités du terminal", () => {
  it("dit non AVANT d'essayer quand le terminal ne sait pas faire", async () => {
    const pont = pontSimule();
    const r = await executerAction(
      pont,
      { nom: "prendre_photo", entree: { camera: "arriere" } },
      { ...TOUT_DISPONIBLE, prendrePhoto: false },
    );
    expect(pont.appels).toEqual([]);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("non_supporte");
    expect(r.message).toMatch(/appareil photo/i);
  });

  it("une capacité absente n'empêche pas les autres", async () => {
    const pont = pontSimule();
    const capacites = { ...TOUT_DISPONIBLE, appelerContact: false };
    await executerAction(pont, { nom: "regler_volume", entree: { sens: "monter" } }, capacites);
    expect(pont.appels).toEqual(["reglerVolume"]);
  });
});

describe("les échecs du pont sont des résultats, pas des exceptions", () => {
  it("un refus de permission remonte comme un résultat renseigné", async () => {
    const pont: PontNatif = {
      capacites: async () => TOUT_DISPONIBLE,
      appelerContact: vi.fn(async () => ({
        ok: false,
        message: "Je n'ai pas accès à vos contacts.",
        code: "permission_refusee" as const,
      })),
      ouvrirApplication: vi.fn(),
      reglerVolume: vi.fn(),
      prendrePhoto: vi.fn(),
    } as unknown as PontNatif;
    const r = await executerAction(
      pont,
      { nom: "appeler_contact", entree: { nom: "awa" } },
      TOUT_DISPONIBLE,
    );
    expect(r.ok).toBe(false);
    expect(r.code).toBe("permission_refusee");
  });
});
