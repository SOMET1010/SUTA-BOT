import { describe, expect, it } from "vitest";
import {
  rowToText,
  sheetToText,
  splitHeaderAndRows,
  workbookToText,
} from "../../src/ingestion/spreadsheet";

const HEADERS = ["Localité", "Région", "Population", "Opérateurs"];

describe("rowToText", () => {
  it("réassocie chaque valeur à son en-tête", () => {
    expect(rowToText(HEADERS, ["BIAKALE", "TONKPI", "5681", "Orange"])).toBe(
      "Localité : BIAKALE ; Région : TONKPI ; Population : 5681 ; Opérateurs : Orange",
    );
  });

  it("omet les colonnes vides plutôt que de les répéter", () => {
    // Les tableurs administratifs comportent beaucoup de colonnes vides ;
    // les rendre noierait l'information utile.
    expect(rowToText(HEADERS, ["BIAKALE", "", "5681", "   "])).toBe(
      "Localité : BIAKALE ; Population : 5681",
    );
  });

  it("ignore une valeur dont l'en-tête est vide", () => {
    expect(rowToText(["Localité", ""], ["BIAKALE", "orphelin"])).toBe("Localité : BIAKALE");
  });

  it("rend une chaîne vide pour une ligne entièrement vide", () => {
    expect(rowToText(HEADERS, ["", "", "", ""])).toBe("");
  });
});

describe("sheetToText", () => {
  it("préfixe chaque ligne du nom de la feuille", () => {
    // Le découpage en fragments peut séparer une ligne de son contexte :
    // « Villages retenus » change le sens de la ligne.
    const text = sheetToText({
      name: "Villages retenus",
      headers: HEADERS,
      rows: [["BIAKALE", "TONKPI", "5681", "Orange"]],
    });
    expect(text).toBe(
      "[Villages retenus] Localité : BIAKALE ; Région : TONKPI ; Population : 5681 ; Opérateurs : Orange",
    );
  });

  it("saute les lignes vides sans laisser de trous", () => {
    const text = sheetToText({
      name: "F1",
      headers: HEADERS,
      rows: [["A", "", "", ""], ["", "", "", ""], ["B", "", "", ""]],
    });
    expect(text).toBe("[F1] Localité : A\n[F1] Localité : B");
  });
});

describe("splitHeaderAndRows", () => {
  it("retient la première ligne non vide comme en-tête", () => {
    const result = splitHeaderAndRows([
      ["", "", ""],
      ["Localité", "Région", "Population"],
      ["BIAKALE", "TONKPI", "5681"],
    ]);
    expect(result.headers).toEqual(["Localité", "Région", "Population"]);
    expect(result.rows).toEqual([["BIAKALE", "TONKPI", "5681"]]);
  });

  it("rend un résultat vide pour une feuille sans aucune donnée", () => {
    expect(splitHeaderAndRows([["", ""], ["", ""]])).toEqual({ headers: [], rows: [] });
    expect(splitHeaderAndRows([])).toEqual({ headers: [], rows: [] });
  });
});

describe("workbookToText", () => {
  it("titre chaque feuille et ignore les feuilles vides", () => {
    const text = workbookToText([
      { name: "Retenus", headers: ["Localité"], rows: [["BIAKALE"]] },
      { name: "Vide", headers: ["Localité"], rows: [[""]] },
      { name: "Écartés", headers: ["Localité"], rows: [["KOKIALO"]] },
    ]);
    expect(text).toBe(
      "# Retenus\n\n[Retenus] Localité : BIAKALE\n\n# Écartés\n\n[Écartés] Localité : KOKIALO",
    );
  });
});
