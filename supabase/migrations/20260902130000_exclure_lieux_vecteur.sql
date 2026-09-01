-- Vague 2 de l'analyse structurelle de Diakité (01/09) : une localité n'est
-- pas un texte à retrouver par similarité, c'est un enregistrement à
-- interroger par son nom. Mesuré au 02/09 : 23 883 chunks de fiches de lieux
-- (gabarit quasi identique) contre 2 113 chunks de prose — 92 % de l'index
-- vectoriel formait un plancher de bruit qui attrapait les requêtes vagues
-- (« recette du foutou » → Mamouesso, « dioula » → Dioulatiedougou).
--
-- Les fiches de lieux (metadata->'nom' présent) sortent de la voie
-- vectorielle : elles restent servies par la voie géographique par NOM
-- (match_chunks_geo, correspondance exacte normalisée). La voie vectorielle
-- ne parcourt plus que la prose, via un index HNSW partiel dédié.

create index if not exists document_chunks_embedding_hnsw_prose
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  where (not (metadata ? 'nom'));

-- Signature élargie : l'ancienne fonction à 3 paramètres doit disparaître,
-- sinon les appels à 3 arguments deviennent ambigus entre les deux versions.
drop function if exists public.match_chunks(text, integer, text[]);

create or replace function public.match_chunks(
  query_embedding text,
  match_count integer default 5,
  allowed_visibility text[] default array['PUBLIC'::text, 'DEMO'::text],
  exclure_lieux boolean default false
)
returns table(chunk_id text, document_title text, section text, content text, metadata jsonb, distance double precision)
language sql
stable security definer
set search_path to 'public'
as $$
  with knn as (
    select c.id, c."documentId", c.section, c.content, c.metadata,
           c.embedding <=> query_embedding::vector as distance
    from document_chunks c
    where (not exclure_lieux) or not (c.metadata ? 'nom')
    order by c.embedding <=> query_embedding::vector asc
    limit greatest(match_count, 1) * 4
  )
  select
    k.id,
    d.title,
    k.section,
    k.content,
    k.metadata,
    k.distance
  from knn k
  join documents d on d.id = k."documentId"
  where d.status = 'INDEXED'
    and d.visibility::text = any(allowed_visibility)
  order by k.distance asc
  limit match_count;
$$;
