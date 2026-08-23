# La vision SUTA — référence commune

> SUTA ne doit jamais devenir un moteur de recherche habillé d'une voix.
>
> C'est un assistant public de confiance, capable de comprendre une question
> citoyenne, de relier les bons niveaux d'information — PND, ministère,
> stratégie ANSUT, PTBA, programmes, terrain — puis de restituer une réponse
> simple, utile, incarnée et contextualisée.
>
> L'expérience doit donner cette impression : « je parle à quelqu'un qui
> comprend mon besoin et qui m'aide à agir », jamais « je consulte une base
> documentaire ».

Ce document est la boussole. Chaque évolution — moteur, corpus, interface,
voix — se juge contre lui. Un changement qui rapproche l'expérience du
« moteur documentaire » est une régression, même s'il est techniquement
propre.

## Les quatre piliers, et où on en est (23/08/2026)

### 1. Conversation vocale naturelle

Le socle : réponse à l'intention (pas à la fiche), synthèse en 1 à 3
phrases, le concret avant le générique, phrase d'attente avant chaque
recherche, interruption sur parole soutenue, déduplication des outils.

- Acquis : le cœur conversationnel synthétise (vérifié à l'écran) ; le
  barge-in ne se déclenche plus sur un bruit ; les fiches arrivent au
  modèle comme des preuves, pas comme un texte à lire.
- Reste : la campagne vocale V-* (coupures, répétition, interruption,
  anaphores) ; le casting des voix (cedar est trop anglophone) ; valider au
  micro le « concret d'abord ».

### 2. Mémoire du contexte

Le fil de la conversation doit servir : la localité dite au premier tour
aiguille les recherches des tours suivants ; on ne redemande jamais ce qui
a été dit.

- Acquis : contexte de session réinjecté à la reconnexion ; le chemin texte
  enrichit la recherche avec le contexte ; en session vocale, le modèle
  garde le fil nativement.
- Reste : c'est le pilier le moins avancé. La mémoire ne structure pas
  encore les recherches (le toponyme du tour 1 n'aiguille pas la voie
  géographique du tour 3) ; rien ne persiste entre deux sessions — choix
  assumé pour un démonstrateur anonyme, à requestionner ensuite.

### 3. Présence visuelle vivante

L'écran accompagne la voix : SUTA au centre, halo et anneaux qui suivent
l'état, cartes contextuelles seulement quand elles aident, jamais un
empilement de composants.

- Acquis : scène de nuit premium, médaillon à l'échelle sur chaque écran,
  émotions par scène, cartes qui composent des phrases complètes, preuves
  discrètes sans étiquette technique.
- Reste : la scène évolue peu PENDANT la réponse (une chorégraphie
  voix-écran plus fine : la carte qui se construit pendant que SUTA
  parle) ; l'image est fixe (pas d'états visuels du personnage).

### 4. Moteur de connaissance gouverné

Il sait ce qu'il peut dire, ce qu'il doit taire, ce qu'il ne sait pas
encore.

- Acquis : le pilier le plus abouti. Six niveaux servis (PND → ministère →
  plan ANSUT → PTBA → programmes → ~15 700 fiches terrain) ; garde
  décisionnelle en profondeur (données nées ADMIN, purge serveur, prompt,
  sélection client) ; sélection des preuves par intention (lieu nommé,
  plancher, diversité lieu/sujet) ; aveu explicite des niveaux absents ;
  banc d'évaluation versionné avec résultats observés.
- Reste : les liens ENTRE niveaux sont narratifs, pas structurés (fiches
  d'alignement à venir — territoire ChatGPT) ; la curation continue
  (fiches FORMER localisées, PTBA arrêté quand il le sera).

## Le test permanent

Avant chaque livraison, une question : « est-ce qu'un citoyen qui vient de
poser sa question a l'impression qu'on l'a compris et qu'on l'aide à agir ? »
Si la réponse ressemble à une consultation de base — un titre de document,
un extrait, une liste — c'est non, quelle que soit la qualité du retrieval.

## La méthode de finition (décision du 23/08)

Le socle existe. On n'ajoute plus de fonctions : on aligne cinq couches —
conversation, connaissance, voix, visuel, gouvernance — par une campagne de
20 à 30 conversations réelles, en traitant chaque défaut jusqu'à ce que
l'expérience soit fluide. À chaque conversation, quatre questions, et
seulement quatre :

1. Est-ce qu'elle a compris ?
2. Est-ce qu'elle a répondu juste ?
3. Est-ce qu'elle a parlé naturellement ?
4. Est-ce que l'écran a aidé ?

Un défaut = un transcript + la question en échec + un correctif ciblé +
une re-vérification. Rien d'autre n'entre dans le lot tant que la boucle
n'est pas fluide.

## Le cap final

Quelqu'un arrive, touche SUTA et dit : « Je veux comprendre ce que l'ANSUT
peut faire pour moi. » À partir de là, SUTA conduit toute la conversation —
accueil, orientation vers son besoin (village connecté ? s'équiper ? se
former ?), réponses concrètes, prochaine étape — sans que la personne ait
besoin de connaître le PND, le PTBA, les programmes ou un seul sigle.
C'est là qu'on saura qu'on a réussi.

## Gouvernance de travail

- Branche de référence : `feature/suta-experience` ; la branche par défaut
  est le miroir de production, avancée uniquement par fast-forward.
- Territoires : moteur/app/edge/migrations (Claude) ; evals/docs/fiches
  (ChatGPT) ; arbitrages produit, tests réels et décisions de visibilité
  (Patrick).
- Le hash du footer (`v-…`) fait foi de la version réellement servie.
- Les zones gelées (gardes de sécurité, RLS, invariants de prompt) ne se
  modifient qu'avec tests verts et jamais pour « passer » un cas.
