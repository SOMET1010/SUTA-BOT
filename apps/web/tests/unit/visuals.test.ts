import { describe, expect, it } from "vitest";
import { visualFromSearchResults } from "@/lib/suta/visuals";

const YAMOUSSOUKRO = { lat: 6.81819, lng: -5.27786, label: "YAMOUSSOUKRO" };
const ZAMBAKRO = { lat: 6.73205, lng: -5.41187, label: "ZAMBAKRO" };

describe("visualFromSearchResults", () => {
  it("n'affiche aucune carte pour un contenu sans dimension géographique", () => {
    // Une question de doctrine ne doit pas produire une carte vide, ni pire,
    // une carte plausible mais fausse.
    expect(visualFromSearchResults([{}, {}])).toBeNull();
    expect(visualFromSearchResults([])).toBeNull();
  });

  it("construit une carte à partir des seuls fragments géolocalisés", () => {
    const visual = visualFromSearchResults([
      { location: YAMOUSSOUKRO },
      {},
      { location: ZAMBAKRO },
    ]);
    expect(visual).toEqual({
      kind: "map",
      points: [YAMOUSSOUKRO, ZAMBAKRO],
      caption: "2 localités",
    });
  });

  it("nomme la localité quand il n'y en a qu'une", () => {
    expect(visualFromSearchResults([{ location: YAMOUSSOUKRO }])?.caption).toBe("YAMOUSSOUKRO");
  });

  it("ne pose qu'un marqueur par lieu, même sur plusieurs fragments", () => {
    // Un même village peut remonter par plusieurs fiches (couverture,
    // scoring, population) : un seul point doit s'afficher.
    const visual = visualFromSearchResults([
      { location: YAMOUSSOUKRO },
      { location: { ...YAMOUSSOUKRO, label: "Scoring AIGF — YAMOUSSOUKRO" } },
    ]);
    expect(visual?.points).toHaveLength(1);
    expect(visual?.caption).toBe("YAMOUSSOUKRO");
  });
});
