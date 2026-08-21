import { describe, expect, it } from "vitest";
import { extractLocation } from "../../src/retrieval/extract-location";

describe("extractLocation", () => {
  it("extracts lat/lng and uses metadata.nom as the label when present", () => {
    const location = extractLocation(
      { population: 32326, lat: 5.79, lng: -5.26, nom: "YOBOUÉKRO" },
      "Fallback title",
    );
    expect(location).toEqual({ lat: 5.79, lng: -5.26, label: "YOBOUÉKRO" });
  });

  it("falls back to the document title when metadata.nom is absent", () => {
    const location = extractLocation({ lat: 5.89, lng: -4.57 }, "Scoring AIGF — ABOUDE-KOUASSIKRO");
    expect(location).toEqual({
      lat: 5.89,
      lng: -4.57,
      label: "Scoring AIGF — ABOUDE-KOUASSIKRO",
    });
  });

  it("returns undefined when metadata is null", () => {
    expect(extractLocation(null, "Titre")).toBeUndefined();
  });

  it("returns undefined when metadata is not an object", () => {
    expect(extractLocation("not-an-object", "Titre")).toBeUndefined();
  });

  it("returns undefined when lat or lng is missing", () => {
    expect(extractLocation({ lat: 5.79 }, "Titre")).toBeUndefined();
    expect(extractLocation({ lng: -5.26 }, "Titre")).toBeUndefined();
  });

  it("returns undefined when lat or lng is not a finite number", () => {
    expect(extractLocation({ lat: Number.NaN, lng: -5.26 }, "Titre")).toBeUndefined();
    expect(extractLocation({ lat: "5.79", lng: -5.26 }, "Titre")).toBeUndefined();
  });

  it("returns undefined for a document with no geographic dimension (e.g. doctrine)", () => {
    expect(extractLocation({ corpusType: "connaissance_metier" }, "Doctrine")).toBeUndefined();
  });
});
