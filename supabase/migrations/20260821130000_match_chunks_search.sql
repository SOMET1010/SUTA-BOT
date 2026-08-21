-- Réplique exacte de `findSimilarChunks` (packages/database/src/chunks.ts) :
-- mêmes filtres (INDEXED, embedding non nul, visibilité) et même distance
-- cosinus, pour que le test de recherche mesure bien ce que fait l'app.
create or replace function match_chunks(
  query_embedding text,
  match_count integer default 5,
  allowed_visibility text[] default array['PUBLIC', 'DEMO']
)
returns table (
  chunk_id text,
  document_title text,
  section text,
  content text,
  metadata jsonb,
  distance double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    d.title,
    c.section,
    c.content,
    c.metadata,
    c.embedding <=> query_embedding::vector
  from document_chunks c
  join documents d on d.id = c."documentId"
  where d.status = 'INDEXED'
    and c.embedding is not null
    and d.visibility::text = any(allowed_visibility)
  order by c.embedding <=> query_embedding::vector asc
  limit match_count;
$$;
