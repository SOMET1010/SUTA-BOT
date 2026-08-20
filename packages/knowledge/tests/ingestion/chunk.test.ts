import { describe, expect, it } from "vitest";
import { chunkText } from "../../src/ingestion/chunk";

describe("chunkText", () => {
  it("keeps a short text as a single chunk", () => {
    const chunks = chunkText("Un court paragraphe.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Un court paragraphe.");
    expect(chunks[0].index).toBe(0);
  });

  it("splits long text into multiple chunks bounded by maxChars", () => {
    const paragraph = "Phrase. ".repeat(200); // ~1600 caractères
    const chunks = chunkText(paragraph, { maxChars: 300, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(320); // marge pour la dernière phrase
    }
  });

  it("assigns sequential indices", () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraphe ${i}. `.repeat(50)).join(
      "\n\n",
    );
    const chunks = chunkText(paragraphs, { maxChars: 200 });
    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));
  });

  it("returns no chunks for empty input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("preserves paragraph boundaries when they fit within maxChars", () => {
    const text = "Premier paragraphe.\n\nDeuxième paragraphe.";
    const chunks = chunkText(text, { maxChars: 1000 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toContain("Premier paragraphe.");
    expect(chunks[0].content).toContain("Deuxième paragraphe.");
  });
});
