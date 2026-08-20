# packages/knowledge

Base de connaissances SUTA : ingestion documentaire, embeddings et
recherche sémantique (RAG) — cahier des charges, sections 14-17.

## Structure

- `src/embeddings/` — abstraction `EmbeddingsProvider` (même principe que
  `RealtimeProvider` dans `packages/ai`) : `MockEmbeddingsProvider`
  (fonctionnel, déterministe, sans appel réseau), squelettes
  `AzureEmbeddingsProvider` / `OpenAIEmbeddingsProvider` en attente des
  informations IT/PIE, sélection par `EMBEDDINGS_PROVIDER`.
- `src/ingestion/` — extraction de texte (PDF, DOCX, TXT, Markdown),
  nettoyage, découpage en fragments, calcul des embeddings et stockage
  (via `@suta/database`).
- `src/retrieval/` — `searchDocuments(query)` : recherche par similarité
  cosinus (pgvector) parmi les fragments indexés. Porte la logique que
  l'outil `searchKnowledge` (Lot 5, `packages/tools`) exposera au modèle.

## ⚠️ À propos du `MockEmbeddingsProvider`

Les vecteurs produits par `MockEmbeddingsProvider` sont déterministes
(le même texte donne toujours le même vecteur) mais **sémantiquement
dénués de sens** : ils sont dérivés d'un hash du texte, pas d'une
compréhension du langage. Le pipeline (extraction → découpage →
embeddings → stockage → recherche pgvector) fonctionne bout en bout avec
ce fournisseur, mais les scores de pertinence ne reflètent pas une
similarité sémantique réelle. Une recherche réellement pertinente
nécessite un vrai fournisseur (`EMBEDDINGS_PROVIDER=azure` ou `openai`)
une fois configuré.

## Utilisation

```bash
# Depuis la racine du monorepo :
npm run knowledge:ingest    # ingère /data/demo (voir cahier des charges, section 49)
npm run knowledge:reindex   # recalcule les embeddings de tous les fragments existants
```

```ts
import { searchDocuments } from "@suta/knowledge";

const { results } = await searchDocuments("Comment bénéficier de ce programme ?");
```

Chaque résultat contient `{ title, content, source, score }` (score dans
`[0, 1]`, 1 = correspondance la plus forte). Si aucun fragment indexé
n'est suffisamment pertinent, `results` est vide — l'appelant (prompt
SUTA) doit alors indiquer qu'il ne dispose pas de l'information plutôt que
d'inventer une réponse (section 58).
