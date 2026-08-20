import { describe, expect, it } from "vitest";
import { MockEmbeddingsProvider } from "../../src/embeddings/MockEmbeddingsProvider";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot; // les vecteurs sont déjà normalisés (norme 1)
}

describe("MockEmbeddingsProvider", () => {
  it("returns vectors matching the configured dimensions", async () => {
    const provider = new MockEmbeddingsProvider(16);
    const [vector] = await provider.embed(["bonjour"]);
    expect(vector).toHaveLength(16);
  });

  it("is deterministic: the same text always yields the same vector", async () => {
    const provider = new MockEmbeddingsProvider(32);
    const [a] = await provider.embed(["Quels sont les programmes disponibles ?"]);
    const [b] = await provider.embed(["Quels sont les programmes disponibles ?"]);
    expect(a).toEqual(b);
  });

  it("produces different vectors for different texts", async () => {
    const provider = new MockEmbeddingsProvider(32);
    const [a] = await provider.embed(["Qu'est-ce que l'ANSUT ?"]);
    const [b] = await provider.embed(["Comment contacter l'ANSUT ?"]);
    expect(a).not.toEqual(b);
    expect(cosineSimilarity(a, b)).toBeLessThan(0.9);
  });

  it("returns unit-length (normalized) vectors", async () => {
    const provider = new MockEmbeddingsProvider(64);
    const [vector] = await provider.embed(["texte de test"]);
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("embeds a batch preserving order", async () => {
    const provider = new MockEmbeddingsProvider(8);
    const [a, b] = await provider.embed(["premier", "second"]);
    const [aAgain] = await provider.embed(["premier"]);
    expect(a).toEqual(aAgain);
    expect(a).not.toEqual(b);
  });
});
