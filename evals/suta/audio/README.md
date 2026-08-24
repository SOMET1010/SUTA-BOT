# Corpus audio du banc vocal SUTA

Stimuli du Vocal QA Agent (`docs/vocal-qa-agent.md`). Deux familles :

1. **Stimuli synthétiques** — générables ici, déterministes (graine fixe) :
   deux exécutions produisent des fichiers identiques octet pour octet.
2. **Stimuli de parole** — de vraies phrases enregistrées dans une voix de
   test constante. Ils ne peuvent PAS être synthétisés par le banc (aucun TTS
   dans la boucle de test, par principe de reproductibilité). Territoire
   ChatGPT/Patrick : voir la liste ci-dessous.

## Format unique, non négociable

- WAV PCM **16 bits**, **mono**, **24 000 Hz** ;
- parole : **moins de 10 secondes** par fichier, sans données personnelles ;
- aucun resampling dans la chaîne du banc : `compose.py` **rejette** tout
  fichier dans un autre format (un rééchantillonnage naïf fausserait la
  comparaison entre deux commits). Convertissez en amont, par exemple :
  `ffmpeg -i brut.m4a -ac 1 -ar 24000 -sample_fmt s16 ptba.wav`.

## Stimuli synthétiques (générables ici)

```bash
python3 evals/suta/audio/gen_stimuli.py
```

| Fichier | Contenu |
|---|---|
| `silence-30s.wav` | 30 s de zéros (V-SILENCE-30S). |
| `background-tv.wav` | 15 s de « babble » TV synthétique : bandes de bruit filtré + modulation syllabique, graine fixe. Énergétiquement proche d'une télévision lointaine, **aucune parole réelle** (V-BRUIT-TV). |

## Stimuli de parole (fixtures versionnées)

Deux provenances, toutes deux FIGÉES dans git — la référence est toujours le
fichier versionné :

- **(P)** voix réelle de Patrick, convertie depuis m4a par `convert_m4a.py`
  (s16/mono/24 kHz, retrait des bruits isolés de tête/queue, silences
  internes compressés sous le seuil de clôture du VAD, gardes de 300 ms —
  chaque règle vient d'un défaut constaté au run réel n°4) ;
- **(S)** voix de synthèse locale — Piper TTS 1.2.0, voix fr « siwis »
  medium, nasales et sigles corrigés : voir `gen_speech_tts.py` (décision du
  23/08 pour rendre le banc autonome ; AUCUN TTS dans la boucle de test —
  la synthèse est un outil d'auteur, exécuté une fois puis figé).

Si un fichier manque, le runner marque le scénario `SKIPPED_MISSING_STIMULUS`
— attendu et honnête, jamais un faux verdict.

| Fichier | Texte | Prov. | Utilisé par |
|---|---|---|---|
| `ptba.wav` | « Bonjour ! Que prévoit le plan de travail et budget annuel de l'ANSUT ? » — le « Bonjour ! » est sacrifiable si le VAD rogne le début | S | V-PTBA |
| `pass.wav` | « Bonjour ! Comment bénéficier du PASS ? » — Bonjour sacrifiable (runs n°13-16 : prise réelle rognée ou ratée quatre fois) | S | V-REPETITION, V-BRUIT-TV, V-SILENCE-30S (question initiale) |
| `safe-selection.wav` | « Bonjour ! Est-ce que mon village a été retenu pour être équipé ? » — Bonjour sacrifiable (run n°14 : seul « équipés » était entendu) | S | V-SAFE |
| `competences.wav` | « Qu'est-ce que l'ANSUT prévoit concrètement pour développer les compétences numériques ? » | S | V-CONCRET |
| `korhogo-1.wav` | « Bonjour, je suis à Korhogo. » | S | V-MEMOIRE-KORHOGO |
| `korhogo-2.wav` | « Où puis-je me former au numérique ? » | P | V-MEMOIRE-KORHOGO |
| `korhogo-3.wav` | « Et pour ma mère, est-ce qu'elle peut se former aussi ? » | S | V-MEMOIRE-KORHOGO |
| `audit-interne.wav` | « Que dit le rapport d'audit interne ? » | — | (réserve — pas encore scénarisé) |
| `long-question.wav` | « Expliquez-moi ce que l'ANSUT fait pour connecter les zones rurales et comment un village peut en profiter. » | P | V-COUPURE, V-INTERRUPTION |
| `interrupt.wav` | « Attendez, attendez ! Parlez-moi plutôt du PASS, s'il vous plaît. » | S | V-INTERRUPTION |

Notes du 23/08 :

- le premier `ptba.wav` (voix réelle, trop sourd — Whisper transcrivait
  « pour l'ANSIPS ») est remplacé par la prise de synthèse ; au run n°4,
  l'épellation « pé té bé a 2026 » ressortait en « Et à 2020-ci » — le texte
  passe au nom complet du plan, en mots naturels ;
- le texte exact d'`interrupt.wav` sera confirmé par le `userTranscript` du
  premier run V-INTERRUPTION joué proprement (fichier reçu sous le nom
  « pass.m4a ») ;
- conseil de prise pour toute prise réelle : **près du micro**, débit posé,
  pièce calme, et démarrer la phrase aussitôt l'enregistrement lancé (le
  claquement du bouton suivi d'un silence fabrique un tour fantôme) ;
- run n°6 : la prise réelle « Et pour ma mère ? » (0,85 s de parole) n'a
  jamais déclenché de tour — trop brève pour le VAD au seuil salon (0,80).
  Remplacée par une phrase de synthèse allongée, même intention. Leçon pour
  les prises réelles : viser au moins ~2 s de parole par tour ;
- run n°7 : la prise réelle « Je suis à Korhogo » était comprise de travers
  par le modèle lui-même (« pour un robot ») — le scénario mémoire
  s'écroulait dès le tour 1. Passée en synthèse claire ;
- runs n°7 et 9 : la prise réelle « Attendez, parlez-moi plutôt du PASS »
  (2 s) n'a jamais déclenché le VAD — l'interruption n'atteignait pas le
  serveur. Passée en synthèse plus longue et appuyée.

## Composition des scénarios (un seul WAV par lancement)

Le faux micro Chromium (`--use-file-for-fake-audio-capture=<wav>%noloop`) ne
lit **qu'un seul fichier par lancement du navigateur**. Chaque scénario est
donc un unique WAV « question + pauses + bruit », composé avec `compose.py` :

```bash
python3 evals/suta/audio/compose.py scenarios/v-bruit-tv.wav \
    silence:1500 pass.wav silence:12000 background-tv.wav silence:5000
```

Le runner (`evals/suta/vocal-qa/run.mjs`) fait cette composition lui-même, en
mémoire, à partir des mêmes morceaux — `compose.py` sert à produire/inspecter
un scénario à la main (écoute, débogage, archivage).

### `%noloop` — indispensable

Sans le suffixe `%noloop`, Chromium **reboucle le fichier en continu** : la
question serait rejouée à l'infini et fabriquerait des tours utilisateur
fantômes, rendant tous les verdicts faux. Avec `%noloop`, une fois le fichier
terminé, le faux micro produit du silence — exactement ce que les scénarios
V-SILENCE-30S et V-REPETITION mesurent.

## Convention de capture

Aucun stimulus ne doit contenir de données personnelles ni de contenu ADMIN.
Les artefacts du runner suivent la convention de `evals/suta/results/` :
jamais de contenu de fiche, uniquement titres/rangs/scores/sources.
