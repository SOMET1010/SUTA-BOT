import { describe, expect, it } from "vitest";
import { parseCorpusFile, parseCorpusLine, toChunkMetadata } from "../../src/ingestion/jsonl-corpus";

const VALID_LINE = JSON.stringify({
  id: "loc-C8202",
  source: "couverture_operateurs",
  type: "localite",
  title: "YOBOUÉKRO (DISTRICT AUTONOME DE YAMOUSSOUKRO)",
  region: "DISTRICT AUTONOME DE YAMOUSSOUKRO",
  departement: "YAMOUSSOUKRO",
  content: "Localité de YOBOUÉKRO, sous-préfecture de KOSSOU...",
  metadata: { population: 32326, nb_operateurs: 3, typologie: "noire" },
});

describe("parseCorpusLine", () => {
  it("parses a well-formed line", () => {
    const entry = parseCorpusLine(VALID_LINE, 1);
    expect(entry.id).toBe("loc-C8202");
    expect(entry.type).toBe("localite");
    expect(entry.region).toBe("DISTRICT AUTONOME DE YAMOUSSOUKRO");
    expect(entry.metadata.population).toBe(32326);
  });

  it("defaults region/departement to null when absent", () => {
    const line = JSON.stringify({
      id: "doctrine-1",
      source: "doctrine",
      type: "connaissance_metier",
      title: "Définition",
      region: null,
      departement: null,
      content: "Texte de doctrine.",
      metadata: {},
    });
    const entry = parseCorpusLine(line, 1);
    expect(entry.region).toBeNull();
    expect(entry.departement).toBeNull();
  });

  it("defaults metadata to an empty object when absent", () => {
    const line = JSON.stringify({
      id: "x",
      source: "s",
      type: "t",
      title: "T",
      content: "C",
    });
    const entry = parseCorpusLine(line, 1);
    expect(entry.metadata).toEqual({});
  });

  it("throws with the line number and id on missing required field", () => {
    const line = JSON.stringify({ id: "loc-1", source: "s", type: "t", content: "C" });
    expect(() => parseCorpusLine(line, 42)).toThrow(/Ligne 42 \(loc-1\).*title/);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseCorpusLine("{not json", 3)).toThrow(/Ligne 3.*JSON invalide/);
  });
});

describe("parseCorpusFile", () => {
  it("parses multiple lines, skipping blank ones", () => {
    const text = `${VALID_LINE}\n\n${VALID_LINE}\n`;
    const { entries, errors } = parseCorpusFile(text);
    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("collects per-line errors without aborting the rest of the file", () => {
    const text = `${VALID_LINE}\n{bad json}\n${VALID_LINE}\n`;
    const { entries, errors } = parseCorpusFile(text);
    expect(entries).toHaveLength(2);
    expect(errors).toEqual([{ line: 2, error: expect.stringContaining("JSON invalide") }]);
  });
});

describe("toChunkMetadata", () => {
  it("merges structural fields with the entry's own metadata", () => {
    const entry = parseCorpusLine(VALID_LINE, 1);
    const metadata = toChunkMetadata(entry);
    expect(metadata).toMatchObject({
      corpusType: "localite",
      corpusSource: "couverture_operateurs",
      region: "DISTRICT AUTONOME DE YAMOUSSOUKRO",
      departement: "YAMOUSSOUKRO",
      population: 32326,
      nb_operateurs: 3,
      typologie: "noire",
    });
  });
});
