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
│   ├── knowledge/              RAG : ingestion, embeddings, retrieval (Lot 4)
│   ├── tools/                   Outils appelables par SUTA (Lot 5)
│   ├── auth/                     Authentification (Lot 4+)
│   ├── database/                  Accès base de données / Prisma (Lot 4)
│   └── observability/              Logs, métriques (Lot 8)
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

- Connexion Realtime réelle (Azure/OpenAI) — Lot 3.
- Base de connaissances, ingestion, retrieval (RAG) — Lot 4.
- Outil `searchKnowledge` et function calling — Lot 5.
- Administration documentaire (`/admin/knowledge`, `/admin/diagnostics`) —
  Lot 6.
- Dataset et script de démonstration Salon, fallback, reset — Lot 7.
- Durcissement (tests étendus, observabilité, sécurité) — Lot 8.
