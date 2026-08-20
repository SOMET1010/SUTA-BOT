# packages/database

Schéma PostgreSQL (Prisma 7 + pgvector) et accès base de données du projet
SUTA (cahier des charges, sections 8, 39-41).

## Tables

`users`, `conversations`, `messages`, `knowledge_sources`, `documents`,
`document_chunks` (avec la colonne pgvector `embedding`), `tool_calls`,
`feedback`, `system_events`.

La colonne `document_chunks.embedding` est déclarée `Unsupported("vector(1536)")`
dans le schéma Prisma (pgvector n'est pas un type Prisma natif) : elle est
lue/écrite exclusivement via `src/chunks.ts` (`setDocumentChunkEmbedding`,
`findSimilarChunks`), avec des requêtes SQL paramétrées — aucun autre
package n'écrit du SQL brut directement sur cette table.

## Prérequis

- PostgreSQL avec l'extension `pgvector` disponible (voir
  `docker-compose.yml` à la racine, image `pgvector/pgvector:pg16`).
- La création de l'extension (`CREATE EXTENSION vector`) nécessite des
  droits superutilisateur. Sur une base gérée (Azure Database for
  PostgreSQL, etc.), un DBA doit l'activer une fois avant la première
  migration ; `prisma migrate deploy` échouera sinon avec `permission
  denied to create extension`.

## Utilisation

```bash
# Depuis la racine du monorepo (charge .env.local automatiquement) :
npm run db:migrate   # applique les migrations (prisma migrate deploy)
npm run db:seed      # crée la source de connaissance de démonstration

# Depuis ce package, pour faire évoluer le schéma en développement :
npm run db:migrate:dev --workspace=@suta/database
```

Le client Prisma est généré dans `generated/client` (non versionné,
régénéré automatiquement par `npm install` via le script `postinstall` de
la racine, ou manuellement avec `npm run generate --workspace=@suta/database`).

## Utilisation dans le code

```ts
import { prisma, setDocumentChunkEmbedding, findSimilarChunks } from "@suta/database";
```
