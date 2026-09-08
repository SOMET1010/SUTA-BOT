-- Terrain du 08/09 (verbatim DSIS) : « Songon » et « Yopougon » introuvables
-- alors que la base les connaît.
--
-- 1. SONGON n'existe qu'en formes composées (SONGON-AGBAN, SONGON-DAGBE…) :
--    la correspondance exacte — même compactée — ne se déclenche jamais sur
--    le nom seul. match_chunks_geo apprend le PRÉFIXE de nom composé : un
--    jeton d'au moins 5 lettres qui ouvre un nom composé (« songon » devant
--    « songon dagbe ») est un toponyme de rang 1 ; la population départage
--    (SONGON-AGBAN, 9 512 hab, sert de porte d'entrée).
--    Garde : 5 lettres minimum et frontière de mot obligatoire (« san » ne
--    devient pas un toponyme, « sanwi » ne matche pas « san pedro »).
--
-- 2. YOPOUGON : sa fiche localité appartient à la famille masquée le 03/09
--    (populations fausses) — resoudre_localite, qui ne lit que PUBLIC+DEMO,
--    ne la voit plus. Deux replis, dans l'ordre : préfixe de nom composé
--    (« Songon » → poste « Songon Agban »), puis DÉPARTEMENT porté par un
--    point connecté public (« Yopougon » → Abri Connecté Yopougon, BTS
--    Yopougon Centre — leurs coordonnées suffisent à situer la commune).
--    En repli, le nom rendu est celui que le citoyen a demandé (initcap),
--    pas le nom technique de l'équipement.

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
       -- Préfixe de nom composé (Songon → « songon dagbe ») : 5 lettres
       -- minimum, frontière de mot obligatoire.
       or (length(replace(t, ' ', '')) >= 5 and exists (
            select 1 from public.document_chunks c2
            where lower(public.f_unaccent(replace(coalesce(c2.metadata->>'nom', ''), '-', ' '))) like t || ' %'))
  ),
  cand as (
    select
      c.id as chunk_id,
      d.title as document_title,
      c.section,
      c.content,
      c.metadata,
      -- Population : métadonnée des fiches Localité, sinon extraite du
      -- contenu (fiches Opérateurs : « Population : 175 667 habitants »).
      coalesce(
        nullif(regexp_replace(coalesce(
          c.metadata->>'population',
          substring(c.content from 'Population : ([0-9  ]+) habitant')
        ), '[^0-9]', '', 'g'), '')::bigint,
        0
      ) as population,
      min(case
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) = topo.t then 1
        when lower(public.f_unaccent(replace(replace(coalesce(c.metadata->>'nom', ''), '-', ''), ' ', ''))) = replace(topo.t, ' ', '') then 1
        when length(replace(topo.t, ' ', '')) >= 5
         and lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) like topo.t || ' %' then 1
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
       or (length(replace(topo.t, ' ', '')) >= 5
           and lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) like topo.t || ' %')
       or lower(public.f_unaccent(replace(coalesce(c.metadata->>'departement', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(coalesce(c.metadata->>'region', ''), '-', ' '))) = topo.t
       or lower(public.f_unaccent(replace(d.title, '-', ' '))) like '%' || topo.t || '%'
    group by c.id, d.title, c.section, c.content, c.metadata
  )
  select chunk_id, document_title, section, content, metadata, geo_rank, toponyme
  from cand
  order by geo_rank asc, population desc, document_title asc
  limit match_count
$function$;

create or replace function public.resoudre_localite(nom_brut text)
 returns table(nom text, departement text, region text, lat double precision, lng double precision)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with demande as (
    select
      lower(public.f_unaccent(replace(trim(nom_brut), '-', ' '))) as espace,
      lower(public.f_unaccent(replace(replace(trim(nom_brut), '-', ''), ' ', ''))) as compact
  ),
  candidats as (
    select
      c.metadata->>'nom' as nom_fiche,
      c.metadata->>'departement' as departement,
      c.metadata->>'region' as region,
      (c.metadata->>'lat')::double precision as lat,
      (c.metadata->>'lng')::double precision as lng,
      d.title as titre,
      case
        -- Tier 0 : correspondance exacte (espacée ou compactée) — inchangé.
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) = demande.espace
          or lower(public.f_unaccent(replace(replace(coalesce(c.metadata->>'nom', ''), '-', ''), ' ', ''))) = demande.compact
          then 0
        -- Tier 1 : préfixe de nom composé (Songon → « Songon Agban »).
        when length(demande.compact) >= 5
          and lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' '))) like demande.espace || ' %'
          then 1
        -- Tier 2 : département d'un point connecté public (Yopougon →
        -- « Abri Connecté Yopougon »). Coordonnées du point : suffisantes
        -- pour situer la commune et calculer le point le plus proche.
        when lower(public.f_unaccent(replace(coalesce(c.metadata->>'departement', ''), '-', ' '))) = demande.espace
          then 2
        else null
      end as tier,
      coalesce(
        nullif(regexp_replace(coalesce(
          c.metadata->>'population',
          substring(c.content from 'Population : ([0-9  ]+) habitant')
        ), '[^0-9]', '', 'g'), '')::bigint,
        0
      ) as population
    from demande, document_chunks c
    join documents d on d.id = c."documentId"
    where d.status = 'INDEXED'
      and d.visibility::text in ('PUBLIC', 'DEMO')
      and c.metadata ? 'lat'
  )
  select
    -- En repli (tiers 1-2), le nom rendu est celui demandé par le citoyen,
    -- pas le nom technique de l'équipement qui a servi à le situer.
    case when tier = 0 then nom_fiche else initcap(lower(trim(nom_brut))) end as nom,
    departement, region, lat, lng
  from candidats
  where tier is not null
  order by
    tier asc,
    -- Les fiches Opérateurs restent la source de résolution prioritaire
    -- (leurs coordonnées alimentent le calcul du point connecté le plus
    -- proche) ; la population départage les homonymes DANS chaque famille.
    (titre like 'Opérateurs mobiles — %') desc,
    population desc
  limit 1;
$function$;
