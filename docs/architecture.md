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
│   ├── auth/                         Accès /admin (mot de passe) — Lot 6, fait
│   │                                  (pas Entra ID, voir phase 2 / section 57)
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

Implémentations (`packages/ai/src/realtime`) :

- `MockRealtimeProvider` — fonctionnelle dès le Lot 0, permet de développer
  et démontrer sans dépendance réseau externe.
- `AzureRealtimeProvider` — **implémentée** (Lot 3, backend). Ressource
  confirmée par l'équipe IT/PIE (cahier des charges, section 67) :
  - Endpoint : `https://dtdi-openai-audio-01.openai.azure.com/`
  - Modèle / déploiement : `gpt-realtime-2.1`
  - Authentification : clé API (`AZURE_OPENAI_API_KEY`, jamais committée)

  `createSession()` appelle l'API GA Azure OpenAI Realtime
  (`POST {endpoint}/openai/v1/realtime/client_secrets`, en-tête `api-key`)
  pour obtenir une clé éphémère (`client_secret.value`, préfixe `ek_`,
  expire en ~1 minute) et la renvoie telle quelle au navigateur — jamais la
  clé API permanente. Les instructions système et les descripteurs d'outils
  (`RealtimeToolDescriptor[]`) sont transmis dans la configuration de
  session (`session.instructions`, `session.tools`, format
  `{ type: "function", name, description, parameters }`).

  `disconnect()` est un no-op : le modèle de clé éphémère n'a pas de
  session à fermer côté serveur, c'est le navigateur qui ferme sa propre
  connexion WebRTC.

  **Connexion WebRTC navigateur — implémentée** (`apps/web/src/lib/realtime/`) :
  - `events.ts` : normalisation pure et testée des événements du canal de
    données GA (`input_audio_buffer.speech_started/stopped`,
    `conversation.item.input_audio_transcription.delta/completed`,
    `response.output_audio_transcript.delta/done`,
    `response.function_call_arguments.done`, `response.created/done`,
    `error`) — contrat vérifié par recherche documentaire (voir
    l'avertissement ci-dessous), pas contre une session live.
  - `RealtimeClient.ts` : `getUserMedia` (micro), `RTCPeerConnection`,
    piste audio distante jouée via `ontrack` → `<audio>` (jamais de
    décodage manuel de chunks base64 — l'audio transite par la piste média
    WebRTC, pas par le canal de données), canal de données `oai-events`,
    échange SDP contre `session.webrtcUrl` (`Authorization: Bearer
    <clientSecret>`), exécution des appels d'outils (`function_call_output`
    + `response.create`), interruption (`response.cancel` déclenché sur
    `speech_started` pendant que SUTA parle, `turn_detection: server_vad`
    côté session).
  - `useRealtimeSession.ts` : pont React — appelle `/api/realtime/session`,
    puis soit connecte une vraie session WebRTC (si `webrtcUrl` présent),
    soit signale un repli vers le flux simulé existant (`MockRealtimeProvider`).
  - `apps/web/src/app/page.tsx` : le bouton micro déclenche une session
    live continue (écoute en continu via VAD serveur, pas de
    « push-to-talk » par tour) quand un fournisseur réel est actif ; sinon
    le flux simulé du Lot 1/7 reste inchangé. Transcription utilisateur et
    SUTA affichée en direct, sources jointes au message final quand
    `search_knowledge` a été appelé.
- `OpenAIRealtimeProvider` — squelette, pour un environnement de
  développement autorisé en attendant.

La sélection se fait uniquement par variable d'environnement
(`AI_PROVIDER=mock|azure|openai`), jamais par une condition codée en dur.
Le nom du modèle et du déploiement sont également externalisés
(`REALTIME_MODEL`, `REALTIME_DEPLOYMENT`).

> ⚠️ Le sandbox de développement utilisé pour cette implémentation a un
> accès réseau sortant restreint (seuls npm/PyPI/GitHub/Anthropic sont
> autorisés) : `AzureRealtimeProvider` a été validée par des tests
> unitaires avec `fetch` simulé (contrat de requête/réponse conforme à la
> documentation Microsoft Learn), mais **pas testée contre la ressource
> Azure réelle**. À valider dans un environnement disposant d'un accès
> réseau à `*.openai.azure.com` et de la clé API réelle.

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
- `AzureEmbeddingsProvider` — implémenté (endpoint GA
  `/openai/v1/embeddings`, même ressource et clé que
  `AzureRealtimeProvider`). `OpenAIEmbeddingsProvider` reste un squelette
  non implémenté.

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

### Ingestion d'un corpus pré-découpé (JSONL)

Distinct du pipeline ci-dessus : `npm run knowledge:ingest-jsonl -- <fichier.jsonl>`
(`packages/knowledge/src/ingestion/{jsonl-corpus,ingest-jsonl}.ts`) ingère
un corpus déjà découpé en chunks autonomes avec identifiant stable — par
exemple le corpus généré depuis l'observatoire du service universel ANSUT
(scoring AIGF, couverture opérateurs, population RGPH, synthèses
régionales, doctrine métier). Chaque ligne devient un `Document` à un seul
`DocumentChunk` (pas de redécoupage, pour préserver le découpage et les
métadonnées déjà optimisés à la génération) ; les champs `region` /
`departement` / `type` / `source` de chaque entrée sont fusionnés dans
`DocumentChunk.metadata`. Idempotent (`upsert` sur l'id stable de chaque
entrée) : une réingestion après régénération du corpus source met à jour
sans dupliquer. Nécessite un `EMBEDDINGS_PROVIDER` réel (`azure` ou
`openai`) — avec `mock`, la recherche sémantique sur un tel volume
(dépend du corpus, potentiellement plusieurs milliers de fragments) ne
serait pas exploitable.

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
prompt SUTA (`packages/ai/src/prompts/suta-system.ts`, règles 6-7)
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

## Administration — Lot 6

`/admin/*` (`apps/web/src/app/admin`) : tableau de bord,
`/admin/knowledge` (liste des documents, upload, suppression,
réindexation, test d'une question — réutilise
`POST /api/tools/search-knowledge`), `/admin/diagnostics` (statut des
services, compteurs documents/fragments, dernière indexation) et
`/admin/settings` (configuration en lecture seule, jamais de secret).

### Contrôle d'accès

`/admin` n'implémente **pas** l'authentification Entra ID de la phase 2
(section 57) : `packages/auth` fournit un contrôle d'accès minimal à mot
de passe partagé (`ADMIN_PASSWORD`), pensé pour un seul opérateur pendant
le Salon.

- Session signée par HMAC-SHA256 (`packages/auth/src/admin-session.ts`),
  sans état côté serveur, cookie `HttpOnly; Secure; SameSite=lax`.
- Désactivé par défaut : sans `ADMIN_PASSWORD`, aucune session ne peut
  être émise ni validée (échec sûr).
- Vérification en deux temps, conformément à la documentation Next.js sur
  l'authentification (« Proxy should not be your only line of defense ») :
  `apps/web/src/proxy.ts` (Next.js 16 a renommé Middleware en Proxy) fait
  une vérification optimiste sur toutes les routes `/admin` et
  `/api/admin`, et chaque page/route revérifie la session côté serveur
  (`hasValidAdminSession()`, `apps/web/src/lib/admin-auth.ts`).

### Upload de documents

`POST /api/admin/documents` écrit le fichier envoyé dans un dossier
temporaire (`os.tmpdir()`), appelle `ingestDocument` (le même pipeline que
`npm run knowledge:ingest`), puis supprime le fichier temporaire — aucune
duplication de la logique d'ingestion entre le CLI et l'admin.

## Résilience Salon — Lot 7

### Fallback automatique (`DEMO_FALLBACK_MODE`)

`createResilientRealtimeProvider` (`packages/ai/src/realtime/factory.ts`)
enveloppe le fournisseur configuré (`AI_PROVIDER`) dans un
`FallbackRealtimeProvider` : si la création de session échoue — panne
réseau, quota, configuration invalide — et que `DEMO_FALLBACK_MODE=true`
(défaut), une session `MockRealtimeProvider` est créée à la place plutôt
que de faire échouer la démonstration (section 24). Utilisé par
`apps/web/src/app/api/realtime/session/route.ts` ; désactivable avec
`DEMO_FALLBACK_MODE=false` pour forcer l'échec (utile en test).

### Écran d'accueil branché sur la vraie recherche

Contrairement au squelette du Lot 1, le canal texte de l'écran d'accueil
(`apps/web/src/app/page.tsx`) appelle réellement `POST
/api/tools/search-knowledge` : la réponse affichée est un extrait du
fragment le plus pertinent réellement récupéré, avec ses sources
(section 38). Seule la question d'identité (« Qui es-tu ? », section 4
Démonstration 1) reste une réponse scriptée
(`apps/web/src/lib/identity-response.ts`) — elle relève de la
personnalité de l'agent, pas de la base de connaissances, et sera portée
par le prompt système une fois un modèle réellement connecté (Lot 3).

### Reset et mode kiosque

Le mode kiosque (`?mode=kiosk`, Lot 1) efface automatiquement la
conversation après inactivité (`useIdleReset`) et affiche désormais un
bouton discret « Réinitialiser » en bas à droite de l'écran (section 23).

## Interface publique — thème clair ANSUT (redesign UI Salon)

Refonte visuelle de l'écran public (`apps/web/src/app/page.tsx`), demandée
sur la base d'une maquette de référence fournie en cours de conversation.
Objectifs : image de marque ANSUT explicite (palette bleu marine/orange
`--ansut-*`, `apps/web/src/app/globals.css`), disposition 3 colonnes
adaptée à un affichage Salon 1920×1080 (suggestions / expérience vocale /
sources), et séparation stricte entre les composants graphiques et le
moteur de conversation.

### Séparation moteur/UI : `useSutaConversation`

`apps/web/src/lib/suta/useSutaConversation.ts` expose un
`SutaConversationController` (`state`, `messages`, `isLive`,
`startListening`, `stopListening`, `interrupt`, `sendText`, `reset`) :
c'est le **seul** point d'entrée vers `useRealtimeSession` /
`RealtimeClient` et `/api/tools/search-knowledge`. Aucun composant
graphique n'appelle Azure/OpenAI ou une route API directement — voir
`SutaVoiceExperience.tsx`, qui reçoit le contrôleur en prop et se contente
de l'afficher.

### Composants (`apps/web/src/components/`)

- `layout/SutaHeader.tsx`, `layout/SutaFooter.tsx` — en-tête et pied de
  page publics (thème clair). Le header affiche le **logo officiel ANSUT**
  (`public/suta/brand/logo-ansut.png`, extrait du fichier vecteur
  `logo_ANSUT_def.pdf` communiqué par l'équipe) via `next/image` — voir
  `public/suta/brand/README.md`. Le wordmark texte « ANSUT CONNECTE »
  reste distinct de ce logo graphique.
- `suta/SutaOrb.tsx` — avatar (halo, anneaux, ondes), entièrement
  CSS/SVG, sans image ni vidéo, piloté par `ConversationState`.
- `suta/VoiceVisualizer.tsx`, `MicrophoneButton.tsx`, `VoiceStatus.tsx` —
  visualiseur d'activité (animation stylisée, pas une amplitude micro
  réelle), bouton micro/raccrocher, pastille de statut.
- `suta/SutaIntroduction.tsx`, `SuggestionGrid.tsx` — écran d'accueil
  (avant toute question) et questions suggérées.
- `suta/ConversationTranscript.tsx`, `SourceDrawer.tsx` — transcription
  « sous-titres » (dernier échange en évidence + historique repliable,
  volontairement pas un fil de discussion façon chat empilé) et panneau
  des sources de la dernière réponse (colonne latérale, jamais de source
  inventée).
- `suta/SutaVoiceExperience.tsx` — composition centrale de la colonne du
  milieu (avatar, statut, transcription, saisie).

Les anciens composants thème sombre (`components/BrandHeader.tsx`,
`SutaOrb.tsx`, `StateIndicator.tsx`, `MicButton.tsx`, `TextComposer.tsx`,
`ExampleQuestions.tsx`, `ConversationTranscript.tsx` à la racine de
`components/`) ont été supprimés — remplacés par leurs équivalents
`layout/`/`suta/` ci-dessus. `/admin` conserve son propre thème sombre
(`--brand-*`), indépendant de cette refonte.

### Encart événement (`lib/event-config.ts`)

`SALON_EVENT_ENABLED`/`SALON_EVENT_NAME`/`SALON_EVENT_LOCATION`/
`SALON_EVENT_START_DATE`/`SALON_EVENT_END_DATE` (`.env.example`) pilotent
un encart optionnel dans `SutaIntroduction` — masqué par défaut, jamais de
date/lieu d'événement codé en dur (aucune donnée événementielle n'a été
fournie par l'ANSUT pour ce MVP).

### Limitations connues de ce lot UI

- **Maquette de référence non disponible dans ce dépôt** : l'image fournie
  en cours de conversation n'a pas pu être enregistrée par cet agent
  (pas d'accès fichier à une pièce jointe de conversation) — voir
  `public/suta/reference/README.md`. La refonte a donc été conçue à partir
  de la description textuelle détaillée de la maquette (palette exacte,
  structure de composants, contraintes explicites) plutôt que d'un import
  pixel-perfect ; une comparaison visuelle directe avec la maquette reste
  à faire par un humain ayant le fichier original.
- **Logo ANSUT officiel intégré, mais variante différente de la
  maquette** — le seul fichier logo réellement communiqué
  (`logo_ANSUT_def.pdf`) est un lockup vertical (icône « éventail » de
  points + sigle) différent du lockup horizontal visible sur la maquette
  de référence (icône « combiné téléphonique »). C'est le fichier
  effectivement livré qui est utilisé — voir `public/suta/brand/README.md`
  pour le détail et pour intégrer la variante horizontale si elle est
  fournie un jour.
- **Visualiseur vocal stylisé, pas une amplitude micro réelle** — un vrai
  visualiseur (Web Audio API `AnalyserNode` sur le flux micro pendant un
  appel live) n'a pas été implémenté dans ce lot ; `VoiceVisualizer.tsx`
  anime des barres en fonction de l'état de conversation uniquement.
- Cette refonte ne modifie ni le backend Realtime ni `/admin` (thème
  sombre volontairement conservé, hors périmètre de la charte ANSUT
  définie pour l'écran public) — voir « Ce qui n'est pas encore
  implémenté » ci-dessous pour le reste du périmètre non couvert.

### QR code — décision : non implémenté

Le cahier des charges (section 23) mentionne un QR code « éventuellement
» vers ANSUT CONNECTE. Aucune URL réelle n'est disponible à ce stade ;
générer un QR code vers un placeholder serait trompeur pour un visiteur
de salon. À ajouter lorsque l'URL cible réelle sera communiquée.

## Déploiement (Vercel)

Premier déploiement en ligne réalisé sur Vercel (racine du projet Vercel :
`apps/web`, preset Next.js). Variables d'environnement requises côté
Vercel (Project Settings → Environment Variables), en plus de celles déjà
documentées dans `.env.example` : `DATABASE_URL` est lue au niveau module
par `packages/database` et fait échouer le build si elle est absente, même
si la base de connaissances n'est pas utilisée dans la démonstration en
cours (une valeur "vide" type `postgresql://user:password@localhost:5432/suta`
suffit à faire passer le build sans base réelle connectée).

**Leçon retenue (bug réel rencontré en production, pas seulement en
théorie)** : `packages/ai/src/prompts/suta-system.md` était chargé via
`fs.readFileSync` au runtime. Fonctionnait en local (`npm run dev`/`npm run
start`, arborescence source complète sur disque) mais échouait sur Vercel
avec `ENOENT` — le *file tracing* des fonctions serverless n'embarque pas
fiablement un fichier lu dynamiquement au runtime depuis un package du
monorepo. Corrigé en remplaçant le `.md` par une constante TypeScript
(`packages/ai/src/prompts/suta-system.ts`) : plus aucune lecture disque au
runtime, donc aucun risque de ce type d'écart environnement local/serverless.
Règle à retenir pour tout futur asset texte chargé par le backend : préférer
une constante importée à une lecture fichier runtime, sauf si l'asset est
volumineux et versionné en base/stockage externe.

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
région `westeurope`) reste **non utilisée** par le MVP — elle est
distincte de la ressource Realtime confirmée (`dtdi-openai-audio-01`,
voir plus haut) et n'a pas vocation à porter la conversation principale.
Elle ne doit être ni supprimée ni modifiée par ce projet.

## Ce qui n'est pas encore implémenté (lots suivants)

- Validation contre la ressource Azure réelle avec la clé API (non
  testable depuis ce sandbox de développement, accès réseau restreint vers
  `*.openai.azure.com`) — le code (backend + WebRTC navigateur) est écrit
  et unit-testé avec des mocks, mais **jamais exécuté contre une session
  live**. À faire en priorité dans un environnement avec accès réseau réel
  avant toute démonstration Salon.
- Outils additionnels (`get_program`, `get_service`, `get_contact`, ...) —
  Lot 5, à mesure des besoins.
- Authentification Entra ID, profils utilisateurs — phase 2 (section 57).
- Feedback 👍/👎, métriques post-salon détaillées — reste du Lot 8.
- Durcissement (tests étendus, observabilité, sécurité) — Lot 8.
