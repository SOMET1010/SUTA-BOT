# Supabase — base de données et ingestion du corpus

Ce dossier porte la partie **Supabase** du projet : la base PostgreSQL de
production (pgvector) et l'outillage d'ingestion du corpus RAG de
l'observatoire ANSUT.

Projet : `suta-bot` (région `eu-west-3`, ref `rnschtjccillctzqnqrb`).

## Pourquoi des Edge Functions et pas le script Node ?

La voie normale d'ingestion reste le script Node décrit dans
`packages/knowledge/README.md` :

```
npm run knowledge:ingest-jsonl -- <corpus.jsonl> [--limit N]
```

Il suppose une machine disposant à la fois du fichier, d'un accès réseau vers
Azure et de `DATABASE_URL`. Quand ce n'est pas le cas, les deux Edge Functions
de ce dossier font le même travail **depuis l'infrastructure Supabase**, qui a
l'accès réseau vers Azure. Elles sont pilotées depuis SQL via `pg_net`.

| Fonction | Rôle |
| --- | --- |
| `load-corpus` | Lit le JSONL déposé dans le bucket `corpus`, upsert dans `documents` / `document_chunks` (sans vecteurs). |
| `embed-chunks` | Calcule les embeddings Azure des fragments dont `embedding IS NULL`, par lots, avec budget de temps. |
| `search-knowledge` | Rejoue la recherche de l'app (mêmes filtres, même distance cosinus) pour vérifier un corpus fraîchement indexé. |

Les deux sont **idempotentes** : les identifiants du corpus sont stables, donc
relancer reprend là où l'exécution s'est arrêtée, sans doublon.

## Prérequis (Dashboard Supabase)

1. **Secret** — Project Settings → Edge Functions → Secrets :
   `AZURE_OPENAI_API_KEY`. C'est le **seul** secret requis.

   L'endpoint (`https://dtdi-openai-audio-01.openai.azure.com/`) et le
   déploiement (`text-embedding-3-small`, 1536 dimensions — ce que la colonne
   `document_chunks.embedding vector(1536)` attend, là où
   `text-embedding-3-large` en produirait 3072 et imposerait une migration)
   ne sont pas des secrets : ils sont codés en valeurs par défaut dans
   `embed-chunks`, surchargeables par `AZURE_OPENAI_ENDPOINT` et
   `EMBEDDINGS_DEPLOYMENT` si la ressource Azure change.
2. **Corpus** — Storage → bucket `corpus` → déposer `ansut_rag_corpus.jsonl`.

## Exécution

`pg_net` est asynchrone et ne dépêche la requête qu'au `COMMIT` : la réponse se
lit donc dans un **second** temps, jamais dans la même transaction.

```sql
-- 1. déclencher
select post_edge('load-corpus');

-- 2. lire la réponse (quelques secondes plus tard)
select id, status_code, content from net._http_response order by id desc limit 1;
```

Puis, en boucle jusqu'à `remaining = 0` :

```sql
select post_edge('embed-chunks', '{"batch": 64, "maxSeconds": 120}'::jsonb);
```

Suivi de l'avancement :

```sql
select count(*) filter (where embedding is not null) as fait,
       count(*) as total
from document_chunks;
```

## Après l'ingestion

`load-corpus` et `embed-chunks` sont un outillage ponctuel, invocable avec la
clé `anon` (publique). Une fois le corpus indexé, les supprimer (Dashboard →
Edge Functions) ferme cette surface. Les réingestions ultérieures se font en
les redéployant depuis ce dossier.

## L'observatoire : reprise et synthèses

`sync-observatoire` va chercher les données vivantes de l'observatoire ANSUT
(projet `ansut-connect`) par son API REST publique, et les réécrit en fiches
auto-descriptives. Elle se pilote de la même manière, table par table :

```sql
select post_edge('sync-observatoire', '{"table":"localites"}'::jsonb);
select post_edge('sync-observatoire', '{"table":"scoring_villages"}'::jsonb);
```

La réponse porte `nextOffset` : tant qu'il n'est pas `null`, relancer avec
`{"table":"…","offset":<nextOffset>}`. Les identifiants dérivant de ceux de
l'observatoire, une reprise interrompue se poursuit sans doublon.

Ces fiches décrivent chacune **un** site ou **un** village. Elles ne savent
donc pas répondre à « où va le programme PU 2024-2025 ? » : une recherche
sémantique compare des textes, elle n'additionne pas 477 fiches. C'est le rôle
de `migrations/20260821150000_syntheses_observatoire.sql`, qui écrit les fiches
que ces questions appellent — une par programme, une par type d'infrastructure,
une par région, une pour le pays, totaux déjà calculés dans le texte même.

**Le cycle de mise à jour complet**, quand l'observatoire évolue :

1. `sync-observatoire` sur les deux tables, jusqu'à `done: true` ;
2. rejouer `20260821150000_syntheses_observatoire.sql` ;
3. `select post_edge('embed-chunks', '{"batchSize":32}'::jsonb);` en boucle
   jusqu'à `remaining = 0` — seules les fiches dont le texte a bougé sont
   réindexées, les autres gardent leur vecteur.

## Les deux niveaux de visibilité

Le corpus porte deux natures de contenu, et la distinction est de fond :

- **`PUBLIC`** — ce qui est communicable : la doctrine, les chiffres publiés,
  les fiches de l'observatoire. C'est ce que SUTA peut dire à un visiteur.
- **`ADMIN`** — la délibération interne : décomptes qui se sont contredits
  avant d'être arbitrés, périmètres non encore rendus publics. SUTA doit le
  savoir, mais ne doit pas le dire.

La séparation est tenue par la requête elle-même, pas par une consigne au
modèle : `search-knowledge` restreint la recherche à `('PUBLIC','DEMO')`.
Une fiche `ADMIN` reste donc invisible même à la question qui la viserait
exactement — c'est vérifiable :

```sql
-- La fiche interne, interrogée avec son propre vecteur : trouvée en ADMIN,
-- introuvable en PUBLIC. Le filtre l'emporte sur la pertinence.
with probe as (select embedding::text as e from document_chunks where id = '<chunk interne>')
select
  (select count(*) from match_chunks((select e from probe), 5, array['PUBLIC','DEMO'])) as public_,
  (select count(*) from match_chunks((select e from probe), 5, array['PUBLIC','DEMO','ADMIN'])) as admin_;
```

Ce dépôt étant **public**, `20260821160000_doctrine_ansut.sql` ne versionne que
les fiches `PUBLIC` : y écrire le contenu des fiches `ADMIN` reviendrait à le
publier, et donc à défaire la séparation. Ces fiches vivent dans la base, qui
en est le dépôt ; leur script de chargement se regénère depuis elle :

```sql
select id, title, visibility, (select content from document_chunks where "documentId" = d.id)
from documents d where "sourceId" = 'ansut-doctrine-interne' and visibility = 'ADMIN';
```

## Les documents transmis par la direction

Une direction ne produit pas des jeux de données : elle produit des decks de
stratégie, des dossiers de conseil d'administration, des projections
financières, des classeurs de linéaires. Ces documents portent l'essentiel de
ce que SUTA doit savoir, et rien de ce qu'une base de données sait ranger.

Le pipeline sait les lire — `.pdf`, `.docx`, `.xlsx`, `.csv`, `.pptx`, `.txt`,
`.md` (voir `packages/knowledge/src/ingestion/extract-text.ts`). Mais lire ne
suffit pas : un fragment de diapositive découpé au petit bonheur —
« 28 Régions concernées » — ne répond à aucune question posée à voix haute.

Le geste est donc en deux temps :

1. **Extraire** le texte du document, une fois, dans un fichier ;
2. **Rédiger des fiches** à partir de ce texte — une idée par fiche, écrite
   pour se comprendre seule, en langue de concitoyen, sans jamais remplacer un
   chiffre exact par un ordre de grandeur — puis les charger avec
   `upsert_document_fiches`.

Le second temps demande du jugement : décider ce qui mérite une fiche, ce qui
relève du communicable et ce qui relève de la délibération interne, et repérer
les chiffres qui se contredisent d'une page à l'autre. C'est du travail de
lecture, confié à un agent par document, avec pour consigne explicite de
signaler les incohérences plutôt que de les trancher.

Ce que ce travail a produit sur les cinq premiers documents : 106 fiches, dont
59 communicables (versionnées dans
`migrations/20260821180000_fiches_documents_direction.sql`) et 47 internes.

Deux réflexes qui ont chacun évité une erreur :

- **Ne jamais déduire le sujet du nom de fichier.** `bus_ansut_presentation`
  ne parle pas d'un autobus : BUS est l'acronyme de Backbone Unifié de
  Services. Une fiche a été écrite exprès pour lever l'ambiguïté, que SUTA
  rencontrera à l'oral.
- **Dater ce qui est daté.** Le classeur du backbone décrit un plan de
  déploiement d'il y a plus de dix ans. Présenter ses 6 326 km comme l'état
  actuel du réseau serait faux ; chaque fiche le précise.

Une limite connue : la mise à plat d'un tableur à sections — un classeur où
un intitulé d'axe sert de séparateur au milieu des données — recopie ce libellé
sur des lignes auxquelles il ne correspond pas. Les lignes brutes du classeur
du backbone n'ont donc **pas** été versées au corpus ; seules les fiches de
synthèse l'ont été.
