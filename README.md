# SUTA — Agent conversationnel vocal d'ANSUT CONNECTE

SUTA est l'agent conversationnel intelligent d'ANSUT CONNECTE. Il permet à un
utilisateur de dialoguer naturellement, principalement par la voix, pour
découvrir les services, programmes et informations de l'ANSUT — sans naviguer
dans une succession de menus.

Ce dépôt contient le **MVP Salon / Démonstrateur V1** décrit dans le cahier
des charges (`docs/cahier-des-charges.md` si présent, sinon voir
`docs/architecture.md`).

## État actuel du projet

Ce commit initial correspond au **Lot 0** (initialisation du monorepo) et au
squelette du **Lot 1** (interface SUTA, sans intégration IA) :

- Monorepo npm workspaces (`apps/*`, `packages/*`).
- `apps/web` — application Next.js / TypeScript / Tailwind avec l'écran
  d'accueil SUTA, la machine à états visuelle, le mode kiosque
  (`?mode=kiosk`) et un endpoint `/api/health`.
- `packages/ai` — abstraction `RealtimeProvider` avec une implémentation
  `MockRealtimeProvider` fonctionnelle, ainsi que des squelettes
  `AzureRealtimeProvider` / `OpenAIRealtimeProvider` en attente des
  informations Azure (voir section 67 du cahier des charges).
- `packages/shared` — types partagés (machine à états de la conversation,
  questions de démonstration).
- `packages/knowledge`, `packages/tools`, `packages/auth`,
  `packages/database`, `packages/observability` — réservés aux lots
  suivants (RAG, outils SUTA, authentification, base de données,
  observabilité), non implémentés dans ce commit.

Aucune clé Azure/OpenAI n'est requise pour lancer le projet : le fournisseur
par défaut (`AI_PROVIDER=mock`) permet de développer et démontrer
l'interface sans dépendance réseau externe.

## Démarrage rapide

Prérequis : Node.js ≥ 20, npm ≥ 10.

```bash
cp .env.example .env.local
npm install
npm run dev
```

L'application est accessible sur http://localhost:3000.

Mode kiosque (Salon) : http://localhost:3000/?mode=kiosk

### Base de données locale (optionnelle à ce stade)

```bash
docker compose up -d
```

Démarre PostgreSQL (avec l'extension `pgvector`) pour les lots à venir
(base de connaissances RAG).

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
| `npm run db:migrate`           | Réservé au Lot 4 (base de données)                          |
| `npm run db:seed`              | Réservé au Lot 4 (base de données)                          |
| `npm run knowledge:ingest`     | Réservé au Lot 4 (ingestion documentaire)                   |
| `npm run knowledge:reindex`    | Réservé au Lot 4 (réindexation)                             |

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
Realtime) → Lot 3 (Realtime réel) → Lot 4 (base de connaissances) → Lot 5
(tool calling) → Lot 6 (administration) → Lot 7 (Salon) → Lot 8
(durcissement).
