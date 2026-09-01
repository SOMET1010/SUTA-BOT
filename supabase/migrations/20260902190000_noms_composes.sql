-- Nom composé tapé en un seul mot (rejeu du 02/09) : « satamasokoro » ne
-- trouvait jamais « Satama-Sokoro » — la voie par nom normalise les traits
-- d'union en espaces, mais un nom écrit collé n'égale jamais la forme
-- espacée. Les fiches existent (Satama-Sokoro, Grand-Bassam…), seul le
-- séparateur les rendait introuvables. La correspondance se fait désormais
-- AUSSI sur la forme compactée (sans espaces ni traits d'union), pour le
-- NOM de localité uniquement : c'est lui que les citoyens écrivent — les
-- départements et régions restent sur la voie existante.

create index if not exists idx_chunks_geo_nom_compact on public.document_chunks
  using btree (lower(public.f_unaccent(replace(replace(coalesce(metadata->>'nom', ''), '-', ''), ' ', ''))));

create or replace function public.match_chunks_geo(tokens text[], allowed_visibility text[], match_count integer default 3)
 returns table(chunk_id text, document_title text, section text, content text, metadata jsonb, geo_rank integer, toponyme text)
 language sql
 stable
as $function$
  with topo as (
    -- Ne retient que les jetons qui sont de vrais lieux du corpus.
    -- Chaque EXISTS est un lookup d'index d'expression.
    select distinct t
    from unnest(tokens) as t
    where exists (select 1 from public.document_chunks c2 where lower(public.f_unaccent(replace(coalesce(c2.metadata->>'nom', ''), '-', ' '))) = t)
       or exists (select 1 from public.document_chunks c2 where lower(public.f_unaccent(replace(replace(coalesce(c2.metadata->>'nom', ''), '-', ''), ' ', ''))) = replace(t, ' ', ''))
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
        when lower(public.f_unaccent(replace(replace(coalesce(c.metadata->>'nom', ''), '-', ''), ' ', ''))) = replace(topo.t, ' ', '') then 1
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'departement', ''), '-', ' '))) = topo.t then 2
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'region', ''), '-', ' '))) = topo.t then 3
        else 4
      end) as geo_rank,
      min(topo.t) as toponyme
    from topo
    cross join public.document_chunks c
    join public.documents d on d.id = c."documentId" and d.visibility::text = any(allowed_visibility)
    where lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(replace(coalesce(c.metadata->>'nom', ''), '-', ''), ' ', ''))) = replace(topo.t, ' ', '')
       or lower(public.f_unaccent(replace(coalesce(c.metadata->>'departement', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(coalesce(c.metadata->>'region', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(d.title, '-', ' '))) like '%' || topo.t || '%'
    group by c.id, d.title, c.section, c.content, c.metadata
  )
  select chunk_id, document_title, section, content, metadata, geo_rank, toponyme
  from cand
  order by geo_rank asc, document_title asc
  limit match_count
$function$;

-- Même tolérance pour le Lot Action : un signalement « grandbassam » doit
-- résoudre la localité Grand-Bassam.
create or replace function public.resoudre_localite(nom_brut text)
 returns table(nom text, departement text, region text, lat double precision, lng double precision)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    c.metadata->>'nom',
    c.metadata->>'departement',
    c.metadata->>'region',
    (c.metadata->>'lat')::double precision,
    (c.metadata->>'lng')::double precision
  from document_chunks c
  join documents d on d.id = c."documentId"
  where d.status = 'INDEXED'
    and d.visibility::text in ('PUBLIC', 'DEMO')
    and (
      lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' ')))
        = lower(public.f_unaccent(replace(trim(nom_brut), '-', ' ')))
      or lower(public.f_unaccent(replace(replace(coalesce(c.metadata->>'nom', ''), '-', ''), ' ', '')))
        = lower(public.f_unaccent(replace(replace(trim(nom_brut), '-', ''), ' ', '')))
    )
    and c.metadata ? 'lat'
  order by (d.title like 'Opérateurs mobiles — %') desc
  limit 1;
$function$;
