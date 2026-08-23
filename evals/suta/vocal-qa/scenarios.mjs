/**
 * Scénarios du Vocal QA Agent — phase 1 (spec : docs/vocal-qa-agent.md).
 *
 * Chaque scénario décrit :
 * - `stimulus` : la recette du WAV unique joué par le faux micro Chromium
 *   (un seul fichier par lancement — limite du flag
 *   `--use-file-for-fake-audio-capture`). Morceaux : { file } (WAV du corpus
 *   `evals/suta/audio/`) ou { silenceMs }. Grâce au suffixe `%noloop`, la fin
 *   du fichier équivaut à un silence prolongé.
 * - `speechFiles` : les WAV de PAROLE requis (enregistrés à la main — voir
 *   evals/suta/audio/README.md). S'il en manque un, le cas est marqué
 *   SKIPPED_MISSING_STIMULUS, jamais joué à moitié.
 * - `generatedFiles` : les WAV synthétiques requis (python3 gen_stimuli.py).
 * - `durationMs` : durée FIXE d'observation après le clic sur l'orbe — le
 *   scénario ne se termine jamais « quand ça a l'air fini », pour que deux
 *   runs du même SHA observent exactement la même fenêtre.
 */

export const SCENARIOS = {
  "V-PTBA": {
    description:
      "Question PTBA 2026 : 1 tour, ≤ 1 recherche, 1 réponse finale au futur, aucun terme décisionnel, aucune promesse de localité.",
    stimulus: [{ silenceMs: 1500 }, { file: "ptba.wav" }],
    speechFiles: ["ptba.wav"],
    generatedFiles: [],
    durationMs: 45_000,
  },

  "V-REPETITION": {
    description:
      "Question PASS puis silence : ≤ 1 recherche, ≤ 1 réponse finale, aucune phrase répétée, aucun flux après la fin.",
    stimulus: [{ silenceMs: 1500 }, { file: "pass.wav" }],
    speechFiles: ["pass.wav"],
    generatedFiles: [],
    durationMs: 60_000,
  },

  "V-BRUIT-TV": {
    description:
      "Question PASS, réponse, puis 15 s de babble TV synthétique : le bruit de fond ne doit déclencher AUCUN nouveau tour, recherche ni réponse.",
    stimulus: [
      { silenceMs: 1500 },
      { file: "pass.wav" },
      { silenceMs: 12_000 }, // fenêtre pour la réponse de SUTA
      { file: "background-tv.wav" },
      { silenceMs: 5_000 },
    ],
    speechFiles: ["pass.wav"],
    generatedFiles: ["background-tv.wav"],
    durationMs: 60_000,
  },

  "V-SILENCE-30S": {
    description:
      "Question PASS, réponse, puis 30 s de silence : zéro nouveau tour, zéro session, zéro outil, zéro réponse fantôme.",
    stimulus: [{ silenceMs: 1500 }, { file: "pass.wav" }, { file: "silence-30s.wav" }],
    speechFiles: ["pass.wav"],
    generatedFiles: ["silence-30s.wav"],
    durationMs: 55_000,
  },
};

/** Suites nommées (`--suite core` = les 4 cas de la phase 1). */
export const SUITES = {
  core: ["V-PTBA", "V-REPETITION", "V-BRUIT-TV", "V-SILENCE-30S"],
};
