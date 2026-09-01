-- LOT ACTION (arbitrage Patrick du 02/09, cible : démo du 9 septembre).
-- « SUTA ne se contente plus de répondre : il aide le citoyen à agir. »
--
-- 1. `signalements` : le citoyen signale une zone mal connectée, l'ANSUT le
--    voit. AUCUNE donnée personnelle : localité, catégorie de problème,
--    commentaire court (purgé de tout motif de numéro de téléphone côté
--    edge), canal. RLS sans policy : seules les Edge Functions (service
--    role) lisent et écrivent.
-- 2. `resoudre_localite` : un nom donné par un citoyen → la localité du
--    corpus (correspondance exacte normalisée, comme match_chunks_geo).
-- 3. `points_connectes_proches` : les localités COUVERTES (au moins un site
--    mobile à moins de 3 km, relevé de mai 2026) les plus proches d'un
--    point — la réponse à « où est-ce que ça capte près de chez moi ? ».

create table if not exists public.signalements (
  id uuid primary key default gen_random_uuid(),
  "createdAt" timestamptz not null default now(),
  localite text not null,
  "localiteReconnue" text,
  departement text,
  region text,
  lat double precision,
  lng double precision,
  probleme text not null check (probleme in ('pas_de_reseau', 'reseau_instable', 'pas_internet', 'autre')),
  commentaire text,
  canal text not null default 'texte' check (canal in ('texte', 'voix'))
);

alter table public.signalements enable row level security;

create index if not exists signalements_created_idx on public.signalements ("createdAt" desc);

create or replace function public.resoudre_localite(nom_brut text)
returns table(nom text, departement text, region text, lat double precision, lng double precision)
language sql
stable security definer
set search_path to 'public'
as $$
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
    and lower(public.f_unaccent(replace(coalesce(c.metadata->>'nom', ''), '-', ' ')))
        = lower(public.f_unaccent(replace(trim(nom_brut), '-', ' ')))
    and c.metadata ? 'lat'
  -- Priorité aux fiches du relevé opérateurs (les plus récentes et les plus
  -- utiles), puis n'importe quelle fiche géolocalisée du même nom.
  order by (d.title like 'Opérateurs mobiles — %') desc
  limit 1;
$$;

create or replace function public.points_connectes_proches(p_lat double precision, p_lng double precision, k integer default 3)
returns table(nom text, departement text, region text, lat double precision, lng double precision, distance_km double precision, extrait text)
language sql
stable security definer
set search_path to 'public'
as $$
  select
    c.metadata->>'nom',
    c.metadata->>'departement',
    c.metadata->>'region',
    (c.metadata->>'lat')::double precision,
    (c.metadata->>'lng')::double precision,
    round((6371 * acos(least(1, greatest(-1,
      cos(radians(p_lat)) * cos(radians((c.metadata->>'lat')::double precision))
      * cos(radians((c.metadata->>'lng')::double precision) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians((c.metadata->>'lat')::double precision))
    ))))::numeric, 1)::double precision as distance_km,
    left(c.content, 400)
  from document_chunks c
  join documents d on d.id = c."documentId"
  where d.status = 'INDEXED'
    and d.visibility::text in ('PUBLIC', 'DEMO')
    and d.title like 'Opérateurs mobiles — %'
    and c.content !~* 'aucun site mobile à moins de 3'
    and c.metadata ? 'lat'
  order by
    (6371 * acos(least(1, greatest(-1,
      cos(radians(p_lat)) * cos(radians((c.metadata->>'lat')::double precision))
      * cos(radians((c.metadata->>'lng')::double precision) - radians(p_lng))
      + sin(radians(p_lat)) * sin(radians((c.metadata->>'lat')::double precision))
    )))) asc
  limit greatest(k, 1);
$$;
