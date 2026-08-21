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
  it("retient la ligne d'en-tête et écarte les lignes vides du dessus", () => {
    const result = splitHeaderAndRows([
      ["", "", ""],
      ["Localité", "Région", "Population"],
      ["BIAKALE", "TONKPI", "5681"],
    ]);
    expect(result.headers).toEqual(["Localité", "Région", "Population"]);
    expect(result.rows).toEqual([["BIAKALE", "TONKPI", "5681"]]);
  });

  it("saute le titre du tableur pour trouver le vrai en-tête", () => {
    // Une feuille transmise par une direction s'ouvre presque toujours sur
    // un titre isolé, qui n'est pas un en-tête de colonnes.
    const result = splitHeaderAndRows([
      ["ANSUT — Backbone national", "", ""],
      ["", "", ""],
      ["Départ", "Arrivée", "Distance (km)"],
      ["BOUNA", "DOROPO", "308"],
    ]);
    expect(result.headers).toEqual(["Départ", "Arrivée", "Distance (km)"]);
    expect(result.rows).toEqual([["BOUNA", "DOROPO", "308"]]);
  });

  it("ne se laisse pas prendre pour un en-tête une ligne de données plus large", () => {
    // La colonne de numérotation n'a pas de titre : la ligne de données est
    // donc plus large que l'en-tête. C'est la première ligne assez large qui
    // gagne, et non la plus large.
    const result = splitHeaderAndRows([
      ["", "Localité", "Région", "Population", "Opérateur", "Statut"],
      ["1", "BIAKALE", "TONKPI", "5681", "Orange", "Actif"],
    ]);
    expect(result.headers).toEqual(["", "Localité", "Région", "Population", "Opérateur", "Statut"]);
  });

  it("fusionne un en-tête de regroupement avec les colonnes qu'il couvre", () => {
    // Deux niveaux : « AU LANCEMENT » et « 2030 » sont des cellules
    // fusionnées au-dessus de colonnes qui, seules, seraient identiques.
    const result = splitHeaderAndRows([
      ["Départ", "Arrivée", "AU LANCEMENT", "", "2030", ""],
      ["Localité", "Localité", "# de paires", "Tarif", "# de paires", "Tarif"],
      ["BOUNA", "DOROPO", "24", "A", "48", "B"],
    ]);
    expect(result.headers).toEqual([
      "Départ — Localité",
      "Arrivée — Localité",
      "AU LANCEMENT — # de paires",
      "AU LANCEMENT — Tarif",
      "2030 — # de paires",
      "2030 — Tarif",
    ]);
    expect(result.rows).toEqual([["BOUNA", "DOROPO", "24", "A", "48", "B"]]);
  });

  it("ne fusionne pas une ligne pleine, qui n'est pas un regroupement", () => {
    // Sans trou intérieur, la ligne du dessus est un en-tête concurrent ou
    // du texte, pas des cellules fusionnées : la fusionner inventerait des
    // en-têtes composés qui n'existent pas.
    const result = splitHeaderAndRows([
      ["A", "B", "C"],
      ["Localité", "Région", "Population"],
      ["BIAKALE", "TONKPI", "5681"],
    ]);
    expect(result.headers).toEqual(["A", "B", "C"]);
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
