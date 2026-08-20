import type { EmbeddingsProvider } from "./types";

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a 32 bits, pour dériver une graine stable à partir d'un texte. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function embedText(text: string, dimensions: number): number[] {
  const random = mulberry32(hashString(text));
  const vector = Array.from({ length: dimensions }, () => random() * 2 - 1);
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

/**
 * Implémentation simulée du fournisseur d'embeddings : aucun appel réseau,
 * vecteurs déterministes (même texte → même vecteur) et normalisés, pour un
 * comportement de similarité cohérent dans les tests et le fallback Salon
 * (`DEMO_FALLBACK_MODE=true`).
 */
export class MockEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = "mock";
  readonly dimensions: number;

  constructor(dimensions = 1536) {
    this.dimensions = dimensions;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => embedText(text, this.dimensions));
  }
}
