# Modèle de connaissance stratégique SUTA

Objectif : permettre à SUTA d’expliquer la chaîne de cohérence publique sans polluer les réponses citoyennes courantes.

## Principe

Les connaissances stratégiques sont structurées en couches reliées explicitement :

`PND -> politique / feuille de route ministérielle -> plan stratégique ANSUT -> PTBA -> programme / projet -> réalisation terrain`

SUTA ne doit jamais inventer un lien entre deux couches. Un lien d’alignement doit être présent dans les métadonnées ou dans une source officielle.

## Deux familles de retrieval

### CITOYEN

Questions opérationnelles et locales : couverture, équipement, formation, démarches, services, disponibilité.

Règle : ne pas injecter spontanément le PND, le plan stratégique ou le PTBA si cela n’aide pas à répondre à la question exacte.

### STRATEGIQUE

Questions de justification, alignement, contribution, performance ou cohérence institutionnelle.

Exemples :
- « Comment ce projet contribue-t-il au PND ? »
- « Quels projets mettent en œuvre la feuille de route du ministère ? »
- « Où retrouve-t-on cet objectif dans le PTBA ? »
- « Quelles réalisations terrain matérialisent cet axe stratégique ? »

Règle : remonter uniquement les liens documentés entre couches.

## Schéma minimal d’un objet stratégique

```json
{
  "id": "string-stable",
  "niveau": "PND | MINISTERE | ANSUT_STRATEGIE | PTBA | PROGRAMME | PROJET | TERRAIN",
  "titre": "libellé officiel",
  "periode": "2026-2030",
  "axe": "axe ou pilier officiel",
  "objectif": "objectif officiel",
  "indicateurs": ["indicateur documenté"],
  "parent_ids": ["objets stratégiques de niveau supérieur"],
  "child_ids": ["objets opérationnels de niveau inférieur"],
  "territoires": ["si applicable"],
  "statut_public": "PUBLIC | INTERNE",
  "source_id": "source officielle",
  "source_ref": "page/section/paragraphe si disponible"
}
```

## Règles de réponse

1. Répondre d’abord à l’intention.
2. Pour une question citoyenne, rester au niveau projet / terrain sauf demande explicite d’explication stratégique.
3. Pour une question stratégique, présenter la chaîne la plus courte qui prouve le lien.
4. Distinguer clairement : `prévu`, `programmé`, `en cours`, `réalisé`.
5. Ne jamais transformer un objectif stratégique en promesse d’exécution locale.
6. Ne jamais déduire qu’une localité sera retenue, financée ou équipée à partir d’un axe PND, d’un PTBA ou d’un projet.
7. Une absence de lien documenté doit produire : « Je n’ai pas de lien officiel suffisamment clair pour l’affirmer. »

## Exemple de réponse attendue

Question : « Pourquoi l’ANSUT porte ce projet ? »

Réponse attendue : expliquer en 1 à 3 phrases le besoin public et le lien documenté avec la stratégie. N’ajouter les niveaux PND / ministère / PTBA que si la question le demande ou si cela clarifie réellement la réponse.

Question : « Comment ce projet contribue au PND ? »

Réponse attendue : citer oralement l’objectif ou l’axe pertinent avec des mots simples, puis expliquer comment le projet le met concrètement en œuvre. Ne pas lire les documents ni réciter toute la chaîne institutionnelle.
