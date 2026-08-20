# Architecture SUTA

Ce document résume les décisions d'architecture prises pour le MVP Salon,
en cohérence avec le cahier des charges.

## Organisation du monorepo

```
suta-bot/
├── apps/
│   └── web/                  Interface ANSUT CONNECTE / SUTA (Next.js)
│                              — inclut le backend via les API routes
│                              Next.js pour le MVP (voir décision ci-dessous)
│
├── packages/
│   ├── ai/                   Abstraction fournisseur Realtime, prompts
│   ├── shared/                Types partagés (machine à états, constantes)
│   ├── database/                Schéma PostgreSQL/pgvector (Prisma) — Lot 4, fait
│   ├── knowledge/                 RAG : ingestion, embeddings, retrieval — Lot 4, fait
│   ├── tools/                       Outils appelables par SUTA — Lot 5, fait
│   ├── auth/                         Authentification (Lot 4+)
│   └── observability/                 Logs, métriques (Lot 8)
│
├── data/
│   └── demo/                 Corpus d'exemple fictif pour le Salon (section 49)
│
├── docs/
├── scripts/
├── .env.example
├── docker-compose.yml
└── README.md
```

## Décision : pas d'`apps/api` séparé pour le MVP

Le cahier des charges (section 8) recommande explicitement, pour le MVP,
d'utiliser les **API routes Next.js** plutôt qu'un backend séparé
(Fastify/NestJS), afin de privilégier la simplicité pour le Salon. Le
backend sécurisé vit donc dans `apps/web/src/app/api/*` et importe la
logique métier depuis les packages (`packages/ai`, puis
`packages/knowledge`, `packages/tools`, etc. au fur et à mesure des lots).
Si une séparation devient nécessaire (montée en charge, déploiement
indépendant), l'extraction vers un `apps/api` dédié est possible sans
réécrire la logique métier, celle-ci étant déjà isolée dans les packages.

## Abstraction du fournisseur IA Realtime

Le code n'est jamais couplé en dur à un fournisseur ou un nom de modèle.

```ts
interface RealtimeProvider {
  createSession(options: CreateRealtimeSessionOptions): Promise<RealtimeSession>;
  disconnect(sessionId: string): Promise<void>;
}
```

Implémentations prévues (`packages/ai/src/realtime`) :

- `MockRealtimeProvider` — fonctionnelle dès ce commit, permet de développer
  et démontrer sans dépendance réseau externe.
- `AzureRealtimeProvider` — squelette, lira `AZURE_OPENAI_*` /
  `REALTIME_MODEL` / `REALTIME_DEPLOYMENT` une fois ces informations
  communiquées par l'équipe IT/PIE (section 67 du cahier des charges).
- `OpenAIRealtimeProvider` — squelette, pour un environnement de
  développement autorisé en attendant Azure.

La sélection se fait uniquement par variable d'environnement
(`AI_PROVIDER=mock|azure|openai`), jamais par une condition codée en dur.
Le nom du modèle et du déploiement sont également externalisés
(`REALTIME_MODEL`, `REALTIME_DEPLOYMENT`) : aucune valeur n'est supposée.

## Base de connaissances (RAG) — Lot 4

Sur le même principe que `RealtimeProvider`, le fournisseur d'embeddings
est abstrait (`packages/knowledge/src/embeddings`) :

```ts
interface EmbeddingsProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
```

- `MockEmbeddingsProvider` — fonctionnel dès ce commit : vecteurs
  déterministes (hash du texte, normalisés), sans appel réseau. Utile pour
  le développement et le fallback Salon, mais **sémantiquement dénué de
  sens** — voir `packages/knowledge/README.md`.
- `AzureEmbeddingsProvider` / `OpenAIEmbeddingsProvider` — squelettes, en
  attente du déploiement d'embeddings confirmé par l'équipe IT/PIE.

Sélection par `EMBEDDINGS_PROVIDER=mock|azure|openai` ; dimension des
vecteurs par `EMBEDDING_DIMENSIONS` (doit correspondre à la colonne
pgvector `document_chunks.embedding`, par défaut `vector(1536)`).

### Pipeline d'ingestion

```
Fichier (PDF/DOCX/TXT/MD)
  → extraction de texte (pdf-parse / mammoth / lecture directe)
  → nettoyage (packages/knowledge/src/ingestion/clean.ts)
  → découpage en fragments, ~1000 caractères, chevauchement ~150 (chunk.ts)
  → embeddings (EmbeddingsProvider, par lot)
  → stockage (Document + DocumentChunk, @suta/database)
```

`npm run knowledge:ingest` ingère `data/demo/` ; `npm run knowledge:reindex`
recalcule les embeddings de tous les fragments existants (utile après un
changement de fournisseur/modèle).

### Stockage pgvector et requêtes brutes

La colonne `document_chunks.embedding` est déclarée `Unsupported("vector(1536)")`
dans le schéma Prisma (pgvector n'a pas de type Prisma natif) : elle est
absente des opérations typées du client et n'est lue/écrite que via
`packages/database/src/chunks.ts` (`setDocumentChunkEmbedding`,
`findSimilarChunks`, requêtes SQL paramétrées avec l'opérateur pgvector
`<=>`). Aucun autre package n'écrit de SQL brut directement sur cette
table — `packages/knowledge` passe uniquement par ces fonctions.

### Recherche

`searchDocuments(query)` (`packages/knowledge/src/retrieval/search.ts`)
calcule l'embedding de la question, recherche les fragments les plus
proches (visibilité `PUBLIC`/`DEMO` par défaut pour le MVP Salon, section
19), et retourne `{ results: [{ title, content, source, score }] }`. Si
aucun résultat n'est suffisamment pertinent, `results` est vide — c'est au
prompt SUTA (`packages/ai/src/prompts/suta-system.md`, règles 6-7)
d'indiquer qu'il ne dispose pas de l'information plutôt que d'inventer une
réponse (section 58).

### Variables d'environnement partagées avec Next.js

`apps/web` (Next.js) ne charge par défaut que ses propres fichiers
`.env*`. Comme la convention du monorepo place `.env.local` à la racine du
dépôt, `apps/web/next.config.ts` charge explicitement `.env.local` puis
`.env` depuis la racine au démarrage (build et dev), pour que
`DATABASE_URL` et les autres variables partagées soient disponibles au
runtime de `apps/web` sans dupliquer le fichier.

## Outils SUTA / function calling — Lot 5

Chaque outil est décrit par une interface générique
(`packages/tools/src/types.ts`) indépendante de tout moteur Realtime :

```ts
interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;   // validation (section 31)
  execute(input: TInput): Promise<TOutput>;
}
```

`runTool(tool, rawInput)` valide l'entrée brute avec le schéma zod avant
d'exécuter l'outil, et rejette (`ToolInputError`) toute entrée invalide —
y compris les clés inconnues, silencieusement supprimées par zod plutôt
que transmises. `describeTool(tool)` génère la description JSON Schema
(`z.toJSONSchema`) attendue par un moteur Realtime.

Seul `search_knowledge` (enveloppe de `searchDocuments`) est implémenté et
activé. **Sa visibilité de recherche n'est jamais un paramètre exposé au
modèle** : elle est fixée côté serveur à `PUBLIC`/`DEMO` pour le MVP
Salon, afin qu'aucune instruction dans la conversation (ni un contenu de
document, section 32) ne puisse élargir l'accès à des informations non
publiques. Voir `packages/tools/README.md`.

### Composition avec le RealtimeProvider

`packages/ai` ne dépend jamais de `packages/tools` — l'interface
`RealtimeToolDescriptor` (JSON Schema générique) découple les deux.
`CreateRealtimeSessionOptions.tools` transporte ces descripteurs jusqu'au
provider. Le point de composition est
`apps/web/src/app/api/realtime/session/route.ts`, qui convertit
`SUTA_TOOLS` (`packages/tools`) en `RealtimeToolDescriptor[]` avant
`provider.createSession({ tools })`.

`MockRealtimeProvider` mémorise les outils reçus (sans les exécuter) pour
permettre de vérifier leur enregistrement. L'exécution réelle d'un appel
d'outil pendant une conversation (réception d'un événement
`function_call` depuis une session Realtime live, exécution, retour du
résultat au modèle) nécessite une connexion Realtime réelle et arrivera
avec le Lot 3. En attendant, l'outil reste testable directement via
`POST /api/tools/search-knowledge`.

## Sécurité — aucun secret côté navigateur

Le frontend ne reçoit jamais de clé Azure/OpenAI, de secret API, de mot de
passe ou de chaîne de connexion. Le flux prévu (Lot 2/3) :

```
Browser → POST /api/realtime/session → Backend (API route Next.js)
        → RealtimeProvider.createSession() → Azure/OpenAI
        ← session/jeton temporaire
Browser ← session/jeton temporaire
Browser → connexion WebRTC directe au service Realtime
```

La clé permanente ne transite jamais par le navigateur ; seule une
autorisation temporaire à courte durée de vie lui est transmise.

## Machine à états de la conversation

Définie dans `packages/shared/src/conversation-state.ts` et consommée par
`apps/web` pour piloter l'interface visuelle :

```
IDLE → LISTENING → THINKING → SEARCHING → SPEAKING
                                     ↘ INTERRUPTED ↗
ERROR, OFFLINE (états transverses)
```

## Ressource Azure Speech existante

La ressource `DTDI-AZURESPEECH-Julaba-01` (Resource Group `ANSUT-DTDI`,
région `westeurope`) est identifiée mais **non utilisée** par le MVP tant
que le modèle Realtime speech-to-speech n'est pas confirmé et provisionné.
Elle ne doit être ni supprimée ni modifiée par ce projet.

## Ce qui n'est pas encore implémenté (lots suivants)

- Connexion Realtime réelle (Azure/OpenAI), et donc exécution effective
  des outils pendant une conversation vocale — Lot 3.
- Outils additionnels (`get_program`, `get_service`, `get_contact`, ...) —
  Lot 5, à mesure des besoins.
- Administration documentaire (`/admin/knowledge`, `/admin/diagnostics`) —
  Lot 6.
- Dataset et script de démonstration Salon, fallback, reset — Lot 7.
- Durcissement (tests étendus, observabilité, sécurité) — Lot 8.
