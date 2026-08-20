# SUTA — Agent conversationnel vocal d'ANSUT CONNECTE

SUTA est l'agent conversationnel intelligent d'ANSUT CONNECTE. Il permet à un
utilisateur de dialoguer naturellement, principalement par la voix, pour
découvrir les services, programmes et informations de l'ANSUT — sans naviguer
dans une succession de menus.

Ce dépôt contient le **MVP Salon / Démonstrateur V1** décrit dans le cahier
des charges (`docs/cahier-des-charges.md` si présent, sinon voir
`docs/architecture.md`).

## État actuel du projet

**Lot 0** (initialisation), squelette du **Lot 1** (interface SUTA) et
**Lot 4** (base de connaissances) sont implémentés :

- Monorepo npm workspaces (`apps/*`, `packages/*`).
- `apps/web` — application Next.js / TypeScript / Tailwind avec l'écran
  d'accueil SUTA, la machine à états visuelle, le mode kiosque
  (`?mode=kiosk`) et un endpoint `/api/health` qui vérifie réellement la
  base de données, le fournisseur Realtime et le fournisseur d'embeddings.
- `packages/ai` — abstraction `RealtimeProvider` avec une implémentation
  `MockRealtimeProvider` fonctionnelle, ainsi que des squelettes
  `AzureRealtimeProvider` / `OpenAIRealtimeProvider` en attente des
  informations Azure (voir section 67 du cahier des charges).
- `packages/database` — schéma PostgreSQL/pgvector (Prisma 7) : `users`,
  `conversations`, `messages`, `documents`, `document_chunks`,
  `knowledge_sources`, `tool_calls`, `feedback`, `system_events`.
- `packages/knowledge` — abstraction `EmbeddingsProvider` (même principe
  que `RealtimeProvider`) avec `MockEmbeddingsProvider` fonctionnel ;
  pipeline d'ingestion (PDF/DOCX/TXT/Markdown → nettoyage → découpage →
  embeddings → stockage) ; recherche sémantique `searchDocuments` par
  similarité cosinus (pgvector).
- `packages/shared` — types partagés (machine à états de la conversation,
  questions de démonstration).
- `data/demo/` — corpus d'exemple **fictif** pour le Salon (clairement
  signalé comme tel ; à remplacer par un corpus validé par l'ANSUT).
- `packages/tools`, `packages/auth`, `packages/observability` — réservés
  aux lots suivants (outils SUTA/function calling, authentification,
  observabilité), non implémentés dans ce commit.

Aucune clé Azure/OpenAI n'est requise pour lancer le projet : les
fournisseurs par défaut (`AI_PROVIDER=mock`, `EMBEDDINGS_PROVIDER=mock`)
permettent de développer et démontrer l'application sans dépendance réseau
externe — seul PostgreSQL avec `pgvector` est nécessaire pour la base de
connaissances.

## Démarrage rapide

Prérequis : Node.js ≥ 20, npm ≥ 10.

```bash
cp .env.example .env.local
npm install
npm run dev
```

L'application est accessible sur http://localhost:3000.

Mode kiosque (Salon) : http://localhost:3000/?mode=kiosk

### Base de données locale

```bash
docker compose up -d      # démarre PostgreSQL + pgvector
npm run db:migrate        # applique le schéma
npm run db:seed           # crée la source de connaissance de démonstration
npm run knowledge:ingest  # indexe le corpus d'exemple (data/demo/)
```

⚠️ La création de l'extension `pgvector` nécessite des droits
superutilisateur sur la base cible (voir `packages/database/README.md`) ;
l'image Docker fournie (`pgvector/pgvector:pg16`) le permet nativement.

## Scripts

| Commande                    | Description                                              |
| ---------------------------- | --------------------------------------------------------- |
| `npm run dev`                | Démarre l'application web en développement                |
| `npm run build`               | Build de production                                        |
| `npm run start`                | Démarre le build de production                             |
| `npm run lint`                 | Lint sur tous les workspaces                                |
| `npm run typecheck`            | Vérification TypeScript sur tous les workspaces             |
| `npm run test`                 | Tests unitaires sur tous les workspaces                     |
| `npm run test:e2e`             | Tests end-to-end (Playwright) de `apps/web`. Nécessite un navigateur Chromium installé (`npx playwright install chromium`), ou `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/chemin/vers/chromium` si un binaire est déjà disponible. |
| `npm run db:migrate`           | Applique les migrations Prisma (`prisma migrate deploy`)   |
| `npm run db:seed`              | Crée la source de connaissance de démonstration              |
| `npm run knowledge:ingest`     | Ingère `data/demo/` (PDF/DOCX/TXT/Markdown) dans la base     |
| `npm run knowledge:reindex`    | Recalcule les embeddings de tous les fragments existants     |

## Architecture

Voir [`docs/architecture.md`](docs/architecture.md) pour le détail de
l'organisation du monorepo, de l'abstraction du fournisseur IA Realtime, et
des principes de sécurité (aucun secret côté navigateur).

## Sécurité — principe fondamental

Le frontend (`apps/web`) ne doit **jamais** contenir de clé Azure/OpenAI, de
secret, de mot de passe ou de chaîne de connexion. Toutes les informations
sensibles restent côté serveur ; le navigateur ne reçoit que des
autorisations temporaires pour établir une session Realtime (voir
`docs/architecture.md`).

## Feuille de route

Le développement procède par lots indépendants (voir cahier des charges,
section 62) : Lot 0 (init) → Lot 1 (interface) → Lot 2 (abstraction
Realtime) → **Lot 4 (base de connaissances, fait)** → Lot 5 (tool calling)
→ Lot 6 (administration) → Lot 7 (Salon) → Lot 8 (durcissement). Le Lot 3
(connexion Realtime Azure réelle) reste bloqué tant que l'équipe IT/PIE
n'a pas communiqué le modèle/deployment Realtime.
