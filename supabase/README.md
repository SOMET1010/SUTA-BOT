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
