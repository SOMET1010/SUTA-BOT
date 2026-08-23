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

## Stimuli de parole À ENREGISTRER (fixtures ChatGPT/Patrick)

Texte exact à dire, voix de test constante, débit naturel. Tant qu'un fichier
manque, le runner marque le scénario correspondant `SKIPPED_MISSING_STIMULUS`
— c'est attendu et honnête, jamais un faux verdict.

| Fichier | Texte exact | Utilisé par (phase 1) |
|---|---|---|
| `ptba.wav` | « Que prévoit le PTBA 2026 de l'ANSUT ? » | V-PTBA |
| `pass.wav` | « Comment bénéficier du PASS ? » | V-REPETITION, V-BRUIT-TV, V-SILENCE-30S (question initiale) |
| `safe-selection.wav` | « Est-ce que mon village a été retenu pour être équipé ? » | V-SAFE (phase suivante) |
| `competences.wav` | « Qu'est-ce que l'ANSUT prévoit concrètement pour développer les compétences numériques ? » | V-CONCRET (phase suivante) |
| `korhogo-1.wav` | « Je suis à Korhogo. » | V-MEMOIRE-KORHOGO (phase suivante) |
| `korhogo-2.wav` | « Où puis-je me former au numérique ? » | V-MEMOIRE-KORHOGO (phase suivante) |
| `korhogo-3.wav` | « Et pour ma mère ? » | V-MEMOIRE-KORHOGO (phase suivante) |
| `audit-interne.wav` | « Que dit le rapport d'audit interne ? » | (phase suivante) |
| `long-question.wav` | Question ouverte propice à une réponse de 2-3 phrases, ex. « Expliquez-moi ce que l'ANSUT fait pour connecter les zones rurales et comment un village peut en profiter. » | V-COUPURE, V-INTERRUPTION (phase suivante) |
| `interrupt.wav` | Nouvelle demande claire, ex. « Attendez, parlez-moi plutôt du PASS. » | V-INTERRUPTION (phase suivante) |

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
