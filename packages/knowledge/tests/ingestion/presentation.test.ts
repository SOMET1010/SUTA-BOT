import { describe, expect, it } from "vitest";
import {
  notesTargetFromRels,
  orderSlideNames,
  presentationToText,
  slideTextFromXml,
} from "../../src/ingestion/presentation.ts";

describe("slideTextFromXml", () => {
  it("recolle les runs d'un même paragraphe", () => {
    // PowerPoint coupe un run à chaque changement de police. Le texte
    // d'origine est « L'ANSUT met en œuvre un programme ».
    const xml =
      "<a:p><a:r><a:t>L'ANSUT met en œuvre </a:t></a:r>" +
      "<a:r><a:t>un</a:t></a:r><a:r><a:t> programme</a:t></a:r></a:p>";
    expect(slideTextFromXml(xml)).toBe("L'ANSUT met en œuvre un programme");
  });

  it("sépare les paragraphes par un saut de ligne", () => {
    const xml = "<a:p><a:t>Contexte</a:t></a:p><a:p><a:t>Cible</a:t></a:p>";
    expect(slideTextFromXml(xml)).toBe("Contexte\nCible");
  });

  it("ignore les paragraphes vides", () => {
    const xml = "<a:p><a:t>Titre</a:t></a:p><a:p></a:p><a:p><a:t>  </a:t></a:p>";
    expect(slideTextFromXml(xml)).toBe("Titre");
  });

  it("décode les entités XML", () => {
    const xml = "<a:p><a:t>Voix, SMS &amp; internet &#8212; zones &lt;blanches&gt;</a:t></a:p>";
    expect(slideTextFromXml(xml)).toBe("Voix, SMS & internet — zones <blanches>");
  });

  it("accepte les balises portant des attributs", () => {
    const xml = '<a:p algn="ctr"><a:t dirty="0">Couverture</a:t></a:p>';
    expect(slideTextFromXml(xml)).toBe("Couverture");
  });

  it("rend une chaîne vide pour une diapositive purement graphique", () => {
    expect(slideTextFromXml("<p:sp><p:pic/></p:sp>")).toBe("");
  });
});

describe("orderSlideNames", () => {
  it("ordonne par numéro et non par ordre alphabétique", () => {
    const names = ["ppt/slides/slide10.xml", "ppt/slides/slide2.xml", "ppt/slides/slide1.xml"];
    expect(orderSlideNames(names)).toEqual([
      "ppt/slides/slide1.xml",
      "ppt/slides/slide2.xml",
      "ppt/slides/slide10.xml",
    ]);
  });
});

describe("notesTargetFromRels", () => {
  it("retrouve la note même quand sa numérotation diffère", () => {
    const rels =
      '<Relationships><Relationship Id="rId1" Target="../slideLayouts/slideLayout2.xml"/>' +
      '<Relationship Id="rId2" Target="../notesSlides/notesSlide3.xml"/></Relationships>';
    expect(notesTargetFromRels(rels)).toBe("ppt/notesSlides/notesSlide3.xml");
  });

  it("rend null quand la diapositive n'a pas de note", () => {
    const rels = '<Relationships><Relationship Id="rId1" Target="../slideLayouts/x.xml"/></Relationships>';
    expect(notesTargetFromRels(rels)).toBeNull();
  });
});

describe("presentationToText", () => {
  it("situe chaque diapositive et rattache ses notes", () => {
    const text = presentationToText([
      { index: 1, body: "Contexte", notes: "L'agence agit pour le compte de l'État." },
      { index: 2, body: "Cible" },
    ]);
    expect(text).toBe(
      "[Diapositive 1]\nContexte\nNotes de présentation : L'agence agit pour le compte de l'État." +
        "\n\n[Diapositive 2]\nCible",
    );
  });

  it("saute les diapositives sans aucun texte", () => {
    // Une diapositive purement graphique ne doit pas produire un bloc vide
    // qui deviendrait un fragment sans contenu à l'indexation.
    expect(presentationToText([{ index: 1, body: "" }, { index: 2, body: "Suite" }])).toBe(
      "[Diapositive 2]\nSuite",
    );
  });
});
