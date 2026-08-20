# SUTA — Agent conversationnel vocal d'ANSUT CONNECTE

SUTA est l'agent conversationnel intelligent d'ANSUT CONNECTE. Il permet à un
utilisateur de dialoguer naturellement, principalement par la voix, pour
découvrir les services, programmes et informations de l'ANSUT — sans naviguer
dans une succession de menus.

Ce dépôt contient le **MVP Salon / Démonstrateur V1** décrit dans le cahier
des charges (`docs/cahier-des-charges.md` si présent, sinon voir
`docs/architecture.md`).

## État actuel du projet

**Lot 0** (initialisation), squelette du **Lot 1** (interface SUTA),
**Lot 4** (base de connaissances), **Lot 5** (tool calling), **Lot 6**
(administration) et l'essentiel du **Lot 7** (Salon) sont implémentés :

- Monorepo npm workspaces (`apps/*`, `packages/*`).
- `apps/web` — application Next.js / TypeScript / Tailwind avec l'écran
  d'accueil SUTA, la machine à états visuelle, le mode kiosque
  (`?mode=kiosk`) et un endpoint `/api/health` qui vérifie réellement la
  base de données, le fournisseur Realtime et le fournisseur d'embeddings.
- `packages/ai` — abstraction `RealtimeProvider` avec `MockRealtimeProvider`
  fonctionnel et `AzureRealtimeProvider` **implémenté** (backend) contre la
  ressource confirmée par IT/PIE (section 67) : endpoint
  `dtdi-openai-audio-01.openai.azure.com`, modèle/déploiement
  `gpt-realtime-2.1`, authentification par clé API. Non testé contre la
  ressource réelle (accès réseau restreint dans l'environnement de
  développement) — voir `docs/architecture.md`. `OpenAIRealtimeProvider`
  reste un squelette.
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
- `packages/tools` — outil `search_knowledge` (function calling), entrée
  validée par zod, résultats restreints côté serveur à la visibilité
  `PUBLIC`/`DEMO` (la visibilité n'est jamais un paramètre laissé au
  modèle — voir sécurité ci-dessous). Enregistré automatiquement auprès du
  `RealtimeProvider` à la création de session
  (`apps/web/src/app/api/realtime/session/route.ts`) ; testable
  directement via `POST /api/tools/search-knowledge`.
- `packages/auth` — contrôle d'accès minimal à `/admin` (mot de passe
  partagé, session signée HMAC) — pas encore l'authentification Entra ID
  de la phase 2 (section 57).
- `/admin` (`apps/web`) — tableau de bord, `/admin/knowledge` (documents,
  upload, suppression, réindexation, test d'une question),
  `/admin/diagnostics` (état des services, compteurs), `/admin/settings`
  (configuration en lecture seule, aucun secret). Protégé par
  `apps/web/src/proxy.ts` (Next.js 16 — anciennement Middleware) +
  vérification côté serveur sur chaque page/route.
- Écran d'accueil branché sur le vrai `search_knowledge` : les questions
  tapées au clavier interrogent réellement la base de connaissances
  (réponse construite uniquement à partir des sources trouvées, jamais
  inventée — section 58), avec affichage des sources.
- Fallback Salon : si le fournisseur Realtime configuré échoue et que
  `DEMO_FALLBACK_MODE=true`, une session `MockRealtimeProvider` est créée
  automatiquement (section 24).
- `data/demo/` — corpus d'exemple **fictif** pour le Salon (clairement
  signalé comme tel ; à remplacer par un corpus validé par l'ANSUT avant
  toute démonstration publique — voir `docs/demo-script.md` et
  `docs/salon-checklist.md`).
- `packages/observability` — réservé au Lot 8, non implémenté dans ce
  commit.

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

Administration : http://localhost:3000/admin (nécessite `ADMIN_PASSWORD`
dans `.env.local` — laissé vide, `/admin` est désactivé par défaut).

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

## Documentation Salon

- [`docs/demo-script.md`](docs/demo-script.md) — script de démonstration
  (3-5 min), avec un état honnête de ce qui est réellement démontrable
  aujourd'hui vs ce qui nécessite le Lot 3.
- [`docs/salon-checklist.md`](docs/salon-checklist.md) — checklist à
  dérouler avant toute démonstration publique (section 48).

## Sécurité — principe fondamental

Le frontend (`apps/web`) ne doit **jamais** contenir de clé Azure/OpenAI, de
secret, de mot de passe ou de chaîne de connexion. Toutes les informations
sensibles restent côté serveur ; le navigateur ne reçoit que des
autorisations temporaires pour établir une session Realtime (voir
`docs/architecture.md`).

## Feuille de route

Le développement procède par lots indépendants (voir cahier des charges,
section 62) : Lot 0 (init) → Lot 1 (interface) → Lot 2 (abstraction
Realtime) → **Lot 4 (base de connaissances, fait)** → **Lot 5 (tool
calling, fait)** → **Lot 6 (administration, fait)** → **Lot 7 (Salon —
dataset, script, kiosque, reset, fallback : fait)** → Lot 8
(durcissement).

**Lot 3** (connexion Realtime Azure réelle) : les informations IT/PIE
(section 67) ont été communiquées. Le **backend** `AzureRealtimeProvider`
et la **connexion WebRTC navigateur** (`apps/web/src/lib/realtime/` — micro,
audio, transcription live, interruption naturelle, appel d'outils) sont
implémentés. **Non vérifié contre la ressource Azure réelle** — cet
environnement de développement n'a pas d'accès réseau sortant vers
`*.openai.azure.com` ; à valider avec la clé API dans un environnement qui
y a accès avant toute démonstration Salon. Voir `docs/architecture.md` et
`docs/demo-script.md`.

**Interface publique — thème clair ANSUT (fait)** : refonte visuelle de
l'écran public sur la base d'une maquette de référence (palette ANSUT
bleu/orange, disposition 3 colonnes 1920×1080, avatar/anneaux/ondes,
séparation moteur/UI via `useSutaConversation`). Voir
`docs/architecture.md` (« Interface publique — thème clair ANSUT ») pour
le détail des composants et les limitations connues (logo officiel et
image de maquette non disponibles dans ce dépôt). `/admin` conserve son
thème sombre existant, hors périmètre de cette refonte.
