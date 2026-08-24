import { describe, expect, it } from "vitest";

import {
  azureMapsConfigured,
  construireUrlGeocode,
  construireUrlTuile,
  extraireLocalites,
} from "@/lib/map/azure-maps";

const ENV = { AZURE_MAPS_KEY: "cle-maps" };

describe("azureMapsConfigured", () => {
  it("ne dépend que d'AZURE_MAPS_KEY", () => {
    expect(azureMapsConfigured({})).toBe(false);
    expect(azureMapsConfigured(ENV)).toBe(true);
  });
});

describe("construireUrlTuile — le relais valide strictement z/x/y", () => {
  it("construit l'URL Render V2 avec étiquettes françaises", () => {
    const url = new URL(construireUrlTuile({ z: 6, x: 31, y: 30 }, ENV));
    expect(url.hostname).toBe("atlas.microsoft.com");
    expect(url.searchParams.get("tilesetId")).toBe("microsoft.base.road");
    expect(url.searchParams.get("zoom")).toBe("6");
    expect(url.searchParams.get("language")).toBe("fr-FR");
    expect(url.searchParams.get("subscription-key")).toBe("cle-maps");
  });

  it("refuse les coordonnées non entières ou hors limites", () => {
    expect(() => construireUrlTuile({ z: 6, x: 1.5, y: 0 }, ENV)).toThrow();
    expect(() => construireUrlTuile({ z: -1, x: 0, y: 0 }, ENV)).toThrow();
    expect(() => construireUrlTuile({ z: 6, x: 64, y: 0 }, ENV)).toThrow();
    expect(() => construireUrlTuile({ z: 23, x: 0, y: 0 }, ENV)).toThrow();
    expect(() => construireUrlTuile({ z: 6, x: Number("abc"), y: 0 }, ENV)).toThrow();
  });

  it("refuse net sans clé", () => {
    expect(() => construireUrlTuile({ z: 6, x: 31, y: 30 }, {})).toThrow();
  });
});

describe("construireUrlGeocode — borné à la Côte d'Ivoire", () => {
  it("encode la localité et force countrySet=CI", () => {
    const url = new URL(construireUrlGeocode("Sinématiali", ENV));
    expect(url.searchParams.get("query")).toBe("Sinématiali");
    expect(url.searchParams.get("countrySet")).toBe("CI");
    expect(url.searchParams.get("language")).toBe("fr-FR");
  });
});

describe("extraireLocalites — réduit la réponse Azure au nécessaire", () => {
  it("garde nom, coordonnées et score ; ignore les entrées incomplètes", () => {
    const reponse = {
      results: [
        {
          score: 0.9,
          position: { lat: 9.582, lon: -5.877 },
          address: { municipality: "Sinématiali", freeformAddress: "Sinématiali, Côte d'Ivoire" },
        },
        { position: { lat: 5 }, address: { municipality: "Cassé" } },
        { score: 0.5, position: { lat: 5.3, lon: -4.0 }, address: {} },
      ],
    };
    expect(extraireLocalites(reponse)).toEqual([
      { label: "Sinématiali", lat: 9.582, lng: -5.877, score: 0.9 },
    ]);
  });

  it("rend une liste vide sur une réponse difforme", () => {
    expect(extraireLocalites(null)).toEqual([]);
    expect(extraireLocalites({})).toEqual([]);
    expect(extraireLocalites({ results: "rien" })).toEqual([]);
  });
});
