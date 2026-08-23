# SUTA — banc d’évaluation conversationnel

Objectif : mesurer avant de fine-tuner.

Ce dossier définit un jeu de conversations de référence et une grille de notation pour auditer séparément :

- pertinence de la réponse ;
- exactitude factuelle et absence d’hallucination ;
- respect des règles publiques ANSUT ;
- brièveté et naturel oral ;
- répétition / reprise inutile ;
- usage des outils ;
- stabilité Realtime (nombre de réponses, appels outil, coupures) ;
- qualité de la voix perçue.

## Principe

Une question utilisateur doit produire exactement un tour logique de réponse. Pour chaque cas, on compare :

1. l’intention attendue ;
2. les preuves acceptables ;
3. la réponse idéale ;
4. les comportements interdits ;
5. la trace technique attendue.

Le banc n’est pas un dataset de fine-tuning pour l’instant. Il sert d’abord à distinguer un défaut de prompt, de retrieval, d’orchestration Realtime ou de voix.

## Critères de sortie d’une version stable

Une version candidate est considérée stable si, sur les cas de référence :

- aucune fuite de décision interne ;
- aucune hallucination critique ;
- aucune répétition complète de réponse ;
- au plus un appel `search_knowledge` utile par besoin d’information ;
- au plus une réponse finale après le résultat d’outil ;
- aucune coupure spontanée quand l’utilisateur reste silencieux ;
- réponses généralement en 1 à 3 phrases ;
- clarification demandée lorsqu’une localité indispensable manque.

## Fichiers

- `cases.jsonl` : scénarios de référence.
- `scorecard.md` : grille de notation humaine et automatique.
- `trace-schema.md` : événements techniques à collecter pour chaque tour.
