# Répliques de l'agent-citoyen (campagne conversationnelle)

Voix du CITOYEN simulé qui converse avec SUTA — jouées par
`evals/suta/vocal-qa/campagne.mjs` via le micro virtuel programmable.

Contrat identique au reste de `evals/suta/audio/` :

- **Figées et versionnées.** Générées UNE fois par `gen_repliques.py`
  (Piper 1.2.0, voix fr-siwis-medium, sha256 vérifié — voir
  `../gen_speech_tts.py` pour la recette complète), puis committées.
  AUCUN TTS pendant un test : la conversation est dynamique par le CHOIX
  de la réplique (selon ce que SUTA vient de dire), jamais par sa synthèse.
- **PCM 16 bits mono 24 kHz**, tête/queue taillées, gardes de 300 ms.
- **Phrases assez longues** (≥ 2,3 s) et attaquées par un mot sacrifiable :
  les prises brèves ou douces ne déclenchent pas le VAD au seuil salon
  (leçons des runs réels 6/7/9/19 du banc).

Pour régénérer (outil d'auteur, hors boucle de test) :

    pip install piper-tts==1.2.0 av numpy
    python3 evals/suta/audio/campagne/gen_repliques.py <dossier-du-modèle>

La référence reste LE FICHIER VERSIONNÉ : l'inférence VITS n'est pas
reproductible octet pour octet.

## Lancer une campagne (poste de test)

    node evals\suta\vocal-qa\campagne.mjs --url https://suta-bot-web.vercel.app --footer-sha-min <sha>

Options : `--persona habitant|curieux|presse` (répétable ; sans option, les
trois défilent), `--headed`, `--out-dir`. Sortie dans
`evals/suta/results/local/campagne-<date>-<footer>/` : `synthese.md` +, par
persona, `conversation.md`, `events.json`, `sortie.webm` (la voix de SUTA,
écoutable). C'est un rapport d'OBSERVATION, pas un verdict : un tour raté a
vocation à devenir un stimulus figé du banc de mesure (`run.mjs`).
