-- Recherche géographique exacte pour la recherche hybride de search-knowledge.
--
-- Constat de salon : le classement purement vectoriel est trop naïf pour les
-- toponymes — « état du réseau à Korhogo » pouvait reléguer la fiche du
-- département derrière des fiches BTS ou de scoring, selon la formulation.
--
-- Principe : LE CORPUS EST LE DICTIONNAIRE. Un jeton de la question n'est
-- traité comme toponyme que s'il existe tel quel dans un champ géographique
-- du corpus (metadata nom / departement / region) — aucune liste de lieux
-- codée en dur, donc jamais en retard sur les fiches réellement chargées.
-- Hiérarchie : localité (nom) avant département, avant région, avant simple
-- présence dans un titre. Insensible aux accents et traits d'union
-- (« san pedro » = « SAN-PÉDRO »).
--
-- Performance : un wrapper immutable rend la normalisation indexable ; trois
-- index d'expression font de la détection de toponymes des lookups (la
-- première version faisait des seqscans avec unaccent() par ligne — timeout
-- sous requêtes concurrentes). Tout est qualifié `public.` : le runner de
-- migration tourne sans search_path.

create extension if not exists unaccent;

create or replace function public.f_unaccent(t text)
returns text language sql immutable parallel safe
as $$ select public.unaccent('public.unaccent'::regdictionary, t) $$;

create index if not exists idx_chunks_geo_nom
  on public.document_chunks (lower(public.f_unaccent(replace(coalesce(metadata->>'nom', ''), '-', ' '))));
create index if not exists idx_chunks_geo_dep
  on public.document_chunks (lower(public.f_unaccent(replace(coalesce(metadata->>'departement', ''), '-', ' '))));
create index if not exists idx_chunks_geo_reg
  on public.document_chunks (lower(public.f_unaccent(replace(coalesce(metadata->>'region', ''), '-', ' '))));

create or replace function public.match_chunks_geo(
  tokens text[],
  allowed_visibility text[],
  match_count int default 3
)
returns table (
  chunk_id text,
  document_title text,
  section text,
  content text,
  metadata jsonb,
  geo_rank int,
  toponyme text
)
language sql
stable
as $$
  with topo as (
    -- Ne retient que les jetons qui sont de vrais lieux du corpus.
    -- Chaque EXISTS est un lookup d'index d'expression.
    select distinct t
    from unnest(tokens) as t
    where exists (select 1 from public.document_chunks c2 where lower(public.f_unaccent(replace(coalesce(c2.metadata->>'nom', ''), '-', ' '))) = t)
       or exists (select 1 from public.document_chunks c2 where lower(public.f_unaccent(replace(coalesce(c2.metadata->>'departement', ''), '-', ' '))) = t)
       or exists (select 1 from public.document_chunks c2 where lower(public.f_unaccent(replace(coalesce(c2.metadata->>'region', ''), '-', ' '))) = t)
  ),
  cand as (
    select
      c.id as chunk_id,
      d.title as document_title,
      c.section,
      c.content,
      c.metadata,
      min(case
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) = topo.t then 1
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'departement', ''), '-', ' '))) = topo.t then 2
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'region', ''), '-', ' '))) = topo.t then 3
        else 4
      end) as geo_rank,
      min(topo.t) as toponyme
    from topo
    cross join public.document_chunks c
    join public.documents d on d.id = c."documentId" and d.visibility::text = any(allowed_visibility)
    where lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(coalesce(c.metadata->>'departement', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(coalesce(c.metadata->>'region', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(d.title, '-', ' '))) like '%' || topo.t || '%'
    group by c.id, d.title, c.section, c.content, c.metadata
  )
  select chunk_id, document_title, section, content, metadata, geo_rank, toponyme
  from cand
  order by geo_rank asc, document_title asc
  limit match_count
$$;
