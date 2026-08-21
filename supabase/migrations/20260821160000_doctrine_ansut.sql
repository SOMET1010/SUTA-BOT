-- Doctrine ANSUT : ce que SUTA doit savoir et que l'observatoire ne dit pas.
--
-- L'observatoire décrit des faits — un site, un village, un score. Il ne dit
-- pas ce qu'ils signifient : ce qu'est une localité « couverte », comment on
-- établit qu'elle ne l'est pas, comment l'agence structure son action. Sans
-- ces repères, SUTA récite des chiffres sans pouvoir les expliquer.
--
-- Ces fiches viennent de la correspondance interne ANSUT / ARTCI / ministère.
-- Elles sont rédigées, pas extraites : chacune énonce une position établie,
-- dans les termes où elle est opposable.
--
-- CE FICHIER NE CONTIENT QUE LES FICHES COMMUNICABLES (visibilité PUBLIC).
--
-- La même correspondance porte des éléments de délibération interne — des
-- décomptes qui se sont contredits avant d'être arbitrés, des arbitrages de
-- périmètre non encore rendus publics. SUTA doit les connaître, mais dans la
-- base seulement, en visibilité ADMIN : `search-knowledge` restreint la
-- recherche à `('PUBLIC','DEMO')`, si bien qu'aucune question posée par un
-- visiteur ne peut les faire apparaître.
--
-- Ce dépôt étant public, leur chargement n'y est pas versionné : publier ici
-- le script qui les insère reviendrait à publier leur contenu, et donc à
-- défaire la séparation que la visibilité ADMIN met en place. Elles vivent
-- dans la base, qui en est le dépôt ; `supabase/README.md` explique comment
-- les relire et en regénérer le script de chargement si besoin.

insert into knowledge_sources (id, name, type, description)
values ('ansut-doctrine-interne', 'Doctrine et travaux ANSUT (correspondance interne)', 'manual',
        'Éléments doctrinaux et de travail issus de la correspondance interne ANSUT / ARTCI / MTNIT, avril-août 2026.')
on conflict (id) do nothing;

with fiches(id, titre, corps) as (values
 ('doctrine-localite-couverte', 'Ce qu''est une localité couverte',
  'La notion de « localité couverte » n''a pas à être redéfinie au cas par cas : elle est établie dans le cahier des charges auquel les opérateurs sont tenus de se conformer. C''est la position de l''ARTCI, régulateur du secteur, qui indique ne pouvoir s''écarter des dispositions qui y sont définies. Certains opérateurs appliquent en pratique une définition différente — l''opérateur MTN considère par exemple qu''une localité est couverte dès lors qu''un site radioélectrique y est présent. Cette divergence explique des écarts importants entre les décomptes de couverture selon la source retenue.'),
 ('doctrine-methode-3km', 'Comment sont identifiées les localités non couvertes',
  'Une localité est rattachée à un site radioélectrique lorsqu''elle se situe dans un périmètre de proximité autour de ce site, la distance étant calculée à partir des coordonnées GPS de la localité et du site. Le rayon de couverture retenu pour les travaux de 2026 est de 3 kilomètres, appliqué au fichier de présence des pylônes de l''AIGF. L''ARTCI a conduit le même calcul de manière indépendante, par programmation Python et analyse spatiale sous ArcGIS Pro, et aboutit au même résultat — une convergence qui vaut validation de la méthode.'),
 ('doctrine-programmes-ddir', 'Les six programmes d''infrastructures de l''ANSUT',
  'La Direction du Développement des Infrastructures et du RNHD structure son action en six programmes : Backbone RNHD, Allumage RNHD, Couverture des Zones Blanches, CICN (Centres Communautaires Intégrés du Numérique), Last Miles, et Abris Connectés. Les projets antérieurs, hérités d''une codification plus ancienne, ont été reclassés dans ces six programmes : ils restent d''actualité mais ont parfois changé d''intitulé. Chaque programme est rattaché à sa ligne budgétaire.'),
 ('doctrine-position-satellite', 'La position de l''ANSUT sur les solutions satellitaires',
  'Le projet en cours de couverture des zones rurales repose sur des sites radio mobiles, et non sur une migration vers des solutions satellitaires. Cette précision a été apportée formellement par l''ANSUT pour corriger une présentation contraire. Une étude distincte sera lancée pour évaluer la pertinence du recours au satellite dans les zones qui demeureraient non couvertes ; ses conclusions sont attendues en 2027. Toute affirmation selon laquelle des sites radio existants seraient migrés vers le satellite est donc inexacte à ce jour.')
),
docs as (
  insert into documents (id, title, filename, "mimeType", "sourceType", "sourceId", visibility, status, "updatedAt")
  select id, titre, id || '.md', 'text/markdown', 'MANUAL', 'ansut-doctrine-interne', 'PUBLIC'::"Visibility", 'PENDING', now()
  from fiches
  on conflict (id) do update set title = excluded.title, visibility = excluded.visibility, "updatedAt" = now()
  returning id
)
insert into document_chunks (id, "documentId", content, metadata)
select f.id || '-chunk', f.id, f.corps,
       jsonb_build_object('corpusSource', 'doctrine_ansut', 'corpusType', 'doctrine',
                          'origine', 'correspondance interne ANSUT 2026')
from fiches f
where f.id in (select id from docs)
on conflict (id) do update set
  content = excluded.content,
  metadata = excluded.metadata,
  -- Réindexation seulement si le texte a bougé : l'embedding coûte un appel
  -- Azure, et rejouer ce fichier ne doit pas en déclencher inutilement.
  embedding = case when document_chunks.content is distinct from excluded.content
                   then null else document_chunks.embedding end;
