# SUTA — Document de passation

*Rédigé le 3 septembre 2026, à partir de l'état réel du dépôt (branche `feature/suta-experience`, commit `e905b94`). Destiné aux équipes qui reprennent le projet.*

Les informations que ce document ne peut pas connaître (comptes, détenteurs de clés) sont marquées **À DÉFINIR** — à compléter par Patrick avant diffusion.

---

## 1. Le projet en bref

**SUTA** est l'agent conversationnel vocal d'ANSUT CONNECTE (Côte d'Ivoire). Un citoyen lui parle naturellement (principalement à la voix) pour obtenir des informations sur la connectivité de sa localité, les opérateurs présents, les formations au numérique, les projets d'inclusion — sans naviguer dans des menus. Le périmètre actuel est le **MVP Salon / Démonstrateur V1**, avec une ambition plus large décrite dans `docs/manifeste-suta.md` et `docs/vision-suta.md`.

Ce que SUTA sait faire aujourd'hui :

- **Conversation vocale temps réel** dans le navigateur : micro → WebRTC → Azure OpenAI Realtime (`gpt-realtime-2.1`), avec transcription live, interruption naturelle (VAD serveur) et appels d'outils pendant la conversation.
- **Réponses fondées sur un corpus** (RAG) : recherche sémantique pgvector sur des fiches ANSUT (couverture réseau localité par localité, opérateurs, RGPH, formations, projets d'inclusion, textes réglementaires…). Règle absolue : jamais de réponse inventée — sans source, SUTA dit qu'il ne sait pas.
- **Canal texte** : les questions tapées passent par le même outil `search_knowledge`.
- **Lot Action** (récent) : le citoyen peut signaler une zone mal couverte et trouver un point connecté (`signaler-zone`, `point-connecte`).
- **Administration** `/admin` : gestion des documents, diagnostics, réglages (mot de passe partagé, pas encore Entra ID).
- **Mode kiosque** (`?mode=kiosk`) pour le Salon, avec reset d'inactivité et fallback automatique vers un fournisseur simulé si Azure échoue (`DEMO_FALLBACK_MODE`).

## 2. Accès et infrastructure

| Élément | Valeur | Qui détient l'accès |
|---|---|---|
| Dépôt GitHub | `SOMET1010/SUTA-BOT` | Patrick (owner) |
| Production | https://suta-bot-web.vercel.app (projet Vercel, racine `apps/web`, preset Next.js, déploiement auto branché sur GitHub) | Compte Vercel : **À DÉFINIR** |
| Base de données prod | Supabase, projet `suta-bot`, ref `rnschtjccillctzqnqrb`, région `eu-west-3` (PostgreSQL + pgvector) | Accès dashboard : **À DÉFINIR** |
| IA temps réel + embeddings | Ressource Azure OpenAI `dtdi-openai-audio-01.openai.azure.com` (confirmée par IT/PIE). Déploiements : `gpt-realtime-2.1` (voix) et `text-embedding-3-small`, 1536 dimensions (embeddings) | Clé API : IT/PIE — contact exact **À DÉFINIR** |
| Ressource Azure Speech `DTDI-AZURESPEECH-Julaba-01` | **Non utilisée** par le MVP. Ne pas supprimer, ne pas modifier | — |

**Où vivent les secrets** (aucun secret dans le dépôt, c'est une règle absolue) :

- Vercel → Project Settings → Environment Variables : `AZURE_OPENAI_API_KEY`, `DATABASE_URL`/`SUTA_DATABASE_URL`, `ADMIN_PASSWORD`, etc. (liste complète des variables : `.env.example` à la racine).
- Supabase → Edge Functions → Secrets : `AZURE_OPENAI_API_KEY` (seul secret requis côté Supabase).
- En local : `.env.local` à la racine du monorepo (jamais committé).

## 3. Architecture technique

Monorepo npm workspaces (Node ≥ 20). Détail complet : `docs/architecture.md` (⚠️ partiellement daté — voir §8).

```
apps/web                Next.js 16 / TypeScript / Tailwind — UI publique (thème clair ANSUT),
                        /admin (thème sombre), et tout le backend via les API routes :
                        /api/health, /api/realtime/session, /api/tools/{search-knowledge,
                        signaler-zone, point-connecte}, /api/voice/speak, /api/map/*, /api/admin/*
packages/ai             Abstraction RealtimeProvider (mock | azure | openai) + prompt système SUTA
packages/knowledge      RAG : EmbeddingsProvider, ingestion (fichiers et JSONL), recherche
packages/database       Schéma Prisma 7 / pgvector, accès SQL paramétré aux vecteurs
packages/tools          Outils function-calling (zod) — visibilité fixée côté serveur, jamais par le modèle
packages/auth           Session /admin signée HMAC
packages/shared         Machine à états de conversation, types partagés
packages/observability  Réservé (Lot 8, non implémenté)
supabase/               Migrations SQL (dernière : 20260903), fiches du corpus (JSON),
                        Edge Functions : load-corpus, load-fiches, embed-chunks, search-knowledge,
                        signaler-zone, point-connecte, signalements-recents, fetch-document,
                        sync-observatoire
evals/                  Bancs d'évaluation (voir §6)
```

Principes de sécurité non négociables :

1. **Aucun secret côté navigateur.** Le backend échange la clé API permanente contre une clé éphémère (`ek_…`, ~1 min) que le navigateur utilise pour sa connexion WebRTC directe à Azure.
2. **La visibilité de recherche (`PUBLIC`/`DEMO`) est fixée côté serveur** — jamais un paramètre exposé au modèle, pour qu'aucune instruction dans la conversation ne puisse élargir l'accès.
3. Toute entrée d'outil est validée par zod avant exécution.
4. Leçon Vercel apprise : jamais de `fs.readFileSync` au runtime dans les packages (le file tracing serverless ne suit pas) — préférer des constantes TypeScript importées.

## 4. État git — important

- **Il n'y a pas de branche `main`** : la branche de travail (et de production Vercel) est **`feature/suta-experience`** (51 commits, dernier `e905b94`). C'est la référence.
- `chore/rapport-banc-web` : branche de livraison du rapport d'observation du 02/09 (voir §7).
- Le pied de page du site affiche `v-<sha court>` du commit déployé — c'est le moyen de vérifier quelle version tourne en production (attendu : `v-e905b94` ou plus récent).
- Conventions : une branche dédiée par chantier, commits fréquents en français décrivant l'intention, **aucune pull request sans demande explicite de Patrick**.

## 5. Démarrer en local

```bash
git clone https://github.com/SOMET1010/SUTA-BOT && cd SUTA-BOT
git checkout feature/suta-experience
cp .env.example .env.local        # compléter au besoin
npm install
docker compose up -d              # PostgreSQL + pgvector local
npm run db:migrate && npm run db:seed && npm run knowledge:ingest
npm run dev                       # http://localhost:3000
```

Aucune clé Azure n'est requise pour développer : `AI_PROVIDER=mock` et `EMBEDDINGS_PROVIDER=mock` (par défaut) fonctionnent hors ligne. La voix réelle exige `AI_PROVIDER=azure` + `AZURE_OPENAI_API_KEY` + un réseau qui atteint `*.openai.azure.com`.

Vérifications : `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e` (Playwright).

## 6. Corpus et base de connaissances

- Les fiches sources sont versionnées dans `supabase/fiches/*.json` (couverture opérateurs, RGPH, PND, PASS, formations, textes de loi, observatoire…) avec deux scripts générateurs Python (`generer-presence-operateurs.py`, `generer-sections-rnhd.py`).
- Deux voies d'ingestion vers la base : le script Node (`npm run knowledge:ingest-jsonl -- <corpus.jsonl>`) quand on a le fichier + la clé Azure + `DATABASE_URL` ; sinon les **Edge Functions Supabase** (`load-corpus`/`load-fiches` puis `embed-chunks`), pilotées en SQL via `pg_net` — idempotentes, relançables sans doublon. Mode d'emploi : `supabase/README.md`.
- La logique de recherche vit aussi côté SQL (`match_chunks_*` dans `supabase/migrations/`) : homonymes (plus grande localité d'abord), noms composés, exclusion des lieux de la voie vectorielle, routage département/localité. **Les migrations récentes (septembre) encodent des décisions métier issues des tests terrain — lire l'historique git avant de les toucher.**

## 7. Qualité : les bancs de test

- `evals/suta/` — banc conversationnel : cas de référence (`conversation-cases.jsonl`, `strategic-cases.jsonl`), grille `scorecard.md`, schéma de trace. Philosophie : *mesurer avant de fine-tuner* ; distinguer défaut de prompt, de retrieval, d'orchestration Realtime ou de voix.
- `evals/suta/vocal-qa/` — **banc vocal automatisé** (spec : `docs/vocal-qa-agent.md`) : pilote la vraie page dans Chromium avec un faux micro alimenté par des WAV figés (`evals/suta/audio/`), établit la vraie session WebRTC et vérifie écoute/réponse/temps de réaction. Suite `core` verte le 23/08 (runs versionnés dans `evals/suta/results/`) ; suite `phase2` en `SKIPPED_MISSING_STIMULUS` tant que les WAV de parole ne sont pas enregistrés. Règles : ne jamais régénérer les stimuli existants, jamais de synthèse vocale dans la boucle de test.
- Le runner refuse de tester un mauvais déploiement (`--footer-sha-min`, comparaison avec le hash du pied de page).

## 8. Chantiers ouverts et points de vigilance (état au 03/09)

1. **Signalement non résolu** : Patrick a constaté que « la quantité d'écoute et de réponses vocales a beaucoup baissé ». La campagne de mesure du 02/09 **n'a pas pu s'exécuter** — l'environnement d'agent utilisé bloquait tout accès réseau vers la production (rapport factuel : `evals/suta/vocal-qa/rapports/rapport-web-20260902-1656.md`, branche `chore/rapport-banc-web`). **Première action recommandée pour l'équipe reprenante** : rejouer le protocole de ce rapport (footer, `/api/health`, 3 sondes `search-knowledge`, banc vocal suite `all`) depuis un poste avec accès réseau normal.
2. **Fiches en attente de validation** : les fiches eGouv dérivées (`4bada6d`) et les 8 fiches citoyennes projets inclusion (`35617e9`) sont marquées « en attente de validation » — validation ANSUT requise avant démonstration publique. Le corpus `data/demo/` est fictif, même règle.
3. **Suite vocale phase 2 bloquée** sur l'enregistrement manuel des WAV de parole (`evals/suta/audio/README.md`).
4. **Reste à faire structurel** (Lot 8 et phase 2) : observabilité/métriques, feedback 👍/👎, durcissement, authentification Entra ID pour `/admin`, outils additionnels (`get_program`, `get_service`, `get_contact`…).
5. **UI** : logo ANSUT intégré en variante verticale (seul fichier livré) — variante horizontale de la maquette à intégrer si fournie ; visualiseur vocal stylisé (pas d'amplitude micro réelle) ; QR code volontairement non implémenté tant qu'aucune URL cible réelle n'existe.
6. **Docs partiellement datées** : `docs/architecture.md` et le README décrivent des états antérieurs à l'arrivée de Supabase en production et du Lot Action (ils disent par exemple « Azure non testé », alors que la production tourne sur Azure ; ils ne mentionnent ni `supabase/`, ni `/api/voice`, ni `/api/map`). En cas de doute : **le code et l'historique git font foi**, puis ce document, puis les autres docs.
7. **Outils à effets de bord** : `signaler-zone` et `point-connecte` écrivent/lisent des signalements réels — ne pas les appeler dans des scripts de test contre la production.

## 9. Où lire quoi

| Besoin | Document |
|---|---|
| Vision produit, personas | `docs/vision-suta.md`, `docs/manifeste-suta.md` |
| Architecture détaillée | `docs/architecture.md` (+ réserves du §8.6) |
| Démonstration Salon | `docs/demo-script.md`, `docs/salon-checklist.md` |
| Banc vocal (spec + usage) | `docs/vocal-qa-agent.md`, `evals/suta/vocal-qa/README.md` |
| Base/corpus Supabase | `supabase/README.md`, `packages/knowledge/README.md` |
| Historique des décisions métier | `git log` (les messages de commit racontent les campagnes de test terrain et les arbitrages) |

## 10. À DÉFINIR (à compléter par Patrick)

- Compte propriétaire du projet Vercel et modalités d'accès pour l'équipe.
- Accès au dashboard Supabase (organisation, rôles).
- Contact IT/PIE détenteur de la clé `AZURE_OPENAI_API_KEY` et procédure de rotation.
- Qui, côté ANSUT, valide les fiches « en attente de validation » (§8.2).
- Provenance et procédure de régénération du corpus `ansut_rag_corpus.jsonl` (observatoire).
- Gouvernance git cible avec l'équipe (protection de branche, revue, création éventuelle d'une branche `main`).
