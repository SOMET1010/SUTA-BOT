-- Synthèses de l'observatoire du service universel.
--
-- Les fiches produites par `sync-observatoire` décrivent chacune UN site ou UN
-- village. Elles répondent bien à « que se passe-t-il à Biakalé ? », mais pas à
-- « où va le programme PU 2024-2025 ? » ni « où en est le déploiement au
-- niveau national ? » : une recherche sémantique compare des textes, elle ne
-- sait pas additionner 477 fiches.
--
-- Ce fichier écrit donc les fiches que la question appelle : une par
-- programme, une par type d'infrastructure, une par région, une pour le pays.
-- Les totaux y sont déjà calculés, en toutes lettres, dans le texte même que
-- la recherche va comparer à la question.
--
-- Rejouable : les identifiants sont déterministes et `upsert_corpus_entries`
-- remet l'embedding à NULL quand le contenu change. Le geste de mise à jour
-- est donc, après chaque `sync-observatoire` :
--
--   1. rejouer ce fichier ;
--   2. `select post_edge('embed-chunks', '{"batchSize":32}'::jsonb);`
--      jusqu'à `remaining = 0`.

-- 1. Par programme de financement : où va la politique publique.
with prog as (
  select
    metadata->>'financement' as programme,
    count(*) as sites,
    count(*) filter (where metadata->>'statut' = 'Actif') as actifs,
    count(*) filter (where metadata->>'statut' = 'En projet') as en_projet,
    count(*) filter (where metadata->>'statut' = 'Terminé') as termines,
    coalesce(sum((metadata->>'populationCouverte')::numeric), 0)::bigint as population,
    count(distinct section) filter (where section is not null) as nb_regions,
    string_agg(distinct metadata->>'typeSite', ', ' order by metadata->>'typeSite') as types,
    string_agg(distinct section, ', ' order by section) filter (where section is not null) as regions
  from document_chunks
  where metadata->>'corpusSource' = 'sites_deployes' and metadata->>'financement' is not null
  group by 1
)
select upsert_corpus_entries(jsonb_agg(jsonb_build_object(
  'id', 'synthese-programme-' || regexp_replace(lower(programme), '[^a-z0-9]+', '-', 'g'),
  'source', 'synthese',
  'type', 'programme',
  'title', 'Programme ' || programme || ' — état du déploiement',
  'region', null,
  'departement', null,
  'content',
    'Le programme ' || programme || ' finance ' || sites || ' site(s) suivis par l''observatoire du service universel : '
    || actifs || ' en service, ' || en_projet || ' en projet, ' || termines || ' terminé(s). '
    || 'Types d''infrastructures concernés : ' || types || '. '
    || case when population > 0 then 'Population couverte recensée : ' || to_char(population, 'FM999G999G999') || ' habitants. ' else '' end
    || 'Présence dans ' || nb_regions || ' région(s) : ' || regions || '.',
  'metadata', jsonb_build_object(
    'corpusSource', 'synthese', 'corpusType', 'programme', 'programme', programme,
    'sites', sites, 'actifs', actifs, 'enProjet', en_projet, 'populationCouverte', population)
))) as fiches_creees
from prog;

-- 2. Par type d'infrastructure : où vont les équipements.
with infra as (
  select
    metadata->>'typeSite' as type_site,
    count(*) as sites,
    count(*) filter (where metadata->>'statut' = 'Actif') as actifs,
    count(*) filter (where metadata->>'statut' = 'En projet') as en_projet,
    coalesce(sum((metadata->>'populationCouverte')::numeric), 0)::bigint as population,
    string_agg(distinct section, ', ' order by section) filter (where section is not null) as regions,
    count(distinct section) filter (where section is not null) as nb_regions
  from document_chunks
  where metadata->>'corpusSource' = 'sites_deployes' and metadata->>'typeSite' is not null
  group by 1
)
select upsert_corpus_entries(jsonb_agg(jsonb_build_object(
  'id', 'synthese-infra-' || regexp_replace(lower(type_site), '[^a-z0-9]+', '-', 'g'),
  'source', 'synthese',
  'type', 'infrastructure',
  'title', 'Infrastructures de type ' || type_site || ' — répartition nationale',
  'region', null,
  'departement', null,
  'content',
    'L''observatoire suit ' || sites || ' site(s) de type ' || type_site || ' : '
    || actifs || ' en service et ' || en_projet || ' en projet. '
    || case when population > 0 then 'Population couverte recensée : ' || to_char(population, 'FM999G999G999') || ' habitants. ' else '' end
    || 'Répartition sur ' || nb_regions || ' région(s) : ' || regions || '.',
  'metadata', jsonb_build_object(
    'corpusSource', 'synthese', 'corpusType', 'infrastructure', 'typeSite', type_site,
    'sites', sites, 'actifs', actifs, 'enProjet', en_projet)
))) as fiches_creees
from infra;

-- 3. Par région : ce qui y est déployé et ce qui y est priorisé.
-- Le nom de région est normalisé en majuscules : l'observatoire écrit
-- « Tonkpi » dans une table et « TONKPI » dans l'autre, ce qui produisait
-- deux fiches concurrentes pour le même territoire.
with sites as (
  select upper(trim(section)) as region,
    count(*) as nb, count(*) filter (where metadata->>'statut' = 'Actif') as actifs,
    count(*) filter (where metadata->>'statut' = 'En projet') as en_projet,
    string_agg(distinct metadata->>'typeSite', ', ' order by metadata->>'typeSite') as types,
    string_agg(distinct metadata->>'financement', ', ' order by metadata->>'financement') as programmes
  from document_chunks
  where metadata->>'corpusSource' = 'sites_deployes' and section is not null
  group by 1
),
villages as (
  select upper(trim(section)) as region,
    count(*) as total, count(*) filter (where (metadata->>'retenu')::boolean) as retenus,
    min((metadata->>'rang')::int) filter (where (metadata->>'retenu')::boolean) as meilleur_rang,
    coalesce(sum((metadata->>'nb_ecoles')::int), 0) as ecoles,
    coalesce(sum((metadata->>'nb_centres_sante')::int), 0) as centres
  from document_chunks
  where metadata->>'corpusSource' = 'scoring_villages' and section is not null
  group by 1
),
fusion as (
  select coalesce(s.region, v.region) as region, s.nb, s.actifs, s.en_projet, s.types, s.programmes,
         v.total, v.retenus, v.meilleur_rang, v.ecoles, v.centres
  from sites s full outer join villages v on s.region = v.region
)
select upsert_corpus_entries(jsonb_agg(jsonb_build_object(
  'id', 'synthese-region-' || substr(md5(region), 1, 12),
  'source', 'synthese', 'type', 'territoire',
  'title', 'Région ' || region || ' — infrastructures déployées et priorisation',
  'region', region, 'departement', null,
  'content',
    'Situation de la région ' || region || ' au regard du service universel. '
    || case when nb is not null then
        'Infrastructures suivies : ' || nb || ' site(s), dont ' || actifs || ' en service et ' || en_projet || ' en projet. '
        || 'Types présents : ' || types || '. Programmes intervenant sur la région : ' || programmes || '. '
       else 'Aucun site d''infrastructure n''est encore recensé dans cette région par l''observatoire. ' end
    || case when total is not null then
        total || ' village(s) y ont été évalués pour la priorisation. '
        || case when retenus > 0
             then retenus || ' village(s) sont retenus dans la vague de financement, le mieux classé étant au rang national ' || meilleur_rang || '. '
             else 'Aucun village de cette région n''est retenu dans la vague de financement actuelle. ' end
        || 'Équipements recensés sur ces villages : ' || ecoles || ' école(s) et ' || centres || ' centre(s) de santé.'
       else '' end,
  'metadata', jsonb_build_object(
    'corpusSource', 'synthese', 'corpusType', 'territoire', 'region', region,
    'sites', coalesce(nb, 0), 'villagesRetenus', coalesce(retenus, 0),
    'ecoles', coalesce(ecoles, 0), 'centresSante', coalesce(centres, 0))
))) as fiches_creees
from fusion;

-- 4. Vue nationale : la réponse à « où en est-on ? ».
with s as (
  select count(*) as sites,
    count(*) filter (where metadata->>'statut' = 'Actif') as actifs,
    count(*) filter (where metadata->>'statut' = 'En projet') as en_projet,
    coalesce(sum((metadata->>'populationCouverte')::numeric), 0)::bigint as pop
  from document_chunks where metadata->>'corpusSource' = 'sites_deployes'
),
v as (
  select count(*) as villages,
    count(*) filter (where (metadata->>'retenu')::boolean) as retenus,
    count(*) filter (where (metadata->>'nb_ecoles')::int > 0) as avec_ecole,
    count(*) filter (where (metadata->>'nb_centres_sante')::int > 0) as avec_centre,
    count(*) filter (where metadata->>'electrifie' = 'NON') as non_electrifies
  from document_chunks where metadata->>'corpusSource' = 'scoring_villages'
)
select upsert_corpus_entries(jsonb_build_array(jsonb_build_object(
  'id', 'synthese-nationale-service-universel',
  'source', 'synthese', 'type', 'vue_nationale',
  'title', 'Observatoire du service universel — vue nationale',
  'region', null, 'departement', null,
  'content',
    'Vue d''ensemble de l''action de l''ANSUT sur le service universel, telle que suivie par l''observatoire. '
    || 'Infrastructures : ' || s.sites || ' site(s) recensés, dont ' || s.actifs || ' en service et ' || s.en_projet || ' en projet, '
    || 'pour une population couverte recensée de ' || to_char(s.pop, 'FM999G999G999') || ' habitants. '
    || 'Priorisation : ' || to_char(v.villages, 'FM999G999') || ' villages ont été évalués selon la méthode AIGF ; '
    || v.retenus || ' sont retenus dans la vague de financement en cours, les autres ne le sont pas, '
    || 'le plus souvent parce qu''une couverture existe déjà ou que leur score reste faible. '
    || 'Équipements des villages évalués : ' || to_char(v.avec_ecole, 'FM999G999') || ' disposent d''au moins une école, '
    || v.avec_centre || ' d''au moins un centre de santé. '
    || to_char(v.non_electrifies, 'FM999G999') || ' villages évalués ne sont pas électrifiés, '
    || 'ce qui conditionne directement la faisabilité d''un déploiement télécom.',
  'metadata', jsonb_build_object(
    'corpusSource', 'synthese', 'corpusType', 'vue_nationale',
    'sites', s.sites, 'villagesEvalues', v.villages, 'villagesRetenus', v.retenus)
))) as fiche_creee
from s, v;
