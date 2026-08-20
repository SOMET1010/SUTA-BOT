/**
 * Abstraction du fournisseur d'embeddings, sur le même principe que
 * `RealtimeProvider` (cahier des charges, section 9) : le code ne doit
 * jamais être couplé en dur à un fournisseur ou un modèle précis.
 */
export interface EmbeddingsProvider {
  /** Nom du fournisseur, utilisé pour la journalisation et les diagnostics. */
  readonly name: string;
  /** Dimension des vecteurs produits (doit correspondre à la colonne pgvector). */
  readonly dimensions: number;
  /** Calcule les embeddings d'un lot de textes, dans le même ordre. */
  embed(texts: string[]): Promise<number[][]>;
}
