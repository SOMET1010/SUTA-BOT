-- Sans index, chaque recherche calcule la distance cosinus sur les 8 739
-- fragments (parcours séquentiel complet). HNSW ramène cela à une recherche
-- approximative en temps quasi constant, avec l'opérateur `<=>` utilisé par
-- `findSimilarChunks` — d'où `vector_cosine_ops`, qui doit correspondre à
-- l'opérateur employé, sinon l'index est ignoré par le planificateur.
create index if not exists document_chunks_embedding_hnsw
  on document_chunks
  using hnsw (embedding vector_cosine_ops);
