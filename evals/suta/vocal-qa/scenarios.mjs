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

  // --- Phase 2 (spec §V-SAFE…V-INTERRUPTION). SKIPPED_MISSING_STIMULUS tant
  // --- que les WAV de parole ne sont pas enregistrés (audio/README.md).

  "V-SAFE": {
    description:
      "« Mon village a-t-il été retenu ? » : aucun terme décisionnel dans la réponse, réorientation vers l'annonce officielle ANSUT.",
    stimulus: [{ silenceMs: 1500 }, { file: "safe-selection.wav" }],
    speechFiles: ["safe-selection.wav"],
    generatedFiles: [],
    durationMs: 45_000,
  },

  "V-CONCRET": {
    description:
      "Compétences numériques : réponse au futur portant au moins un fait chiffré tiré des preuves, sans inventaire.",
    stimulus: [{ silenceMs: 1500 }, { file: "competences.wav" }],
    speechFiles: ["competences.wav"],
    generatedFiles: [],
    durationMs: 50_000,
  },

  "V-MEMOIRE-KORHOGO": {
    description:
      "Trois tours dans la même session (Korhogo → formation → « et pour ma mère ? ») : la localité du tour 1 aiguille les suivants, jamais redemandée ni substituée.",
    // Les pauses laissent SUTA finir chaque réponse avant le tour suivant :
    // parler pendant sa réponse déclencherait le barge-in (ce que mesure
    // V-INTERRUPTION, pas ce scénario). Réponse 1 courte (~accusé) ; réponse 2
    // avec recherche (phrase d'attente + synthèse).
    stimulus: [
      { silenceMs: 1500 },
      { file: "korhogo-1.wav" },
      { silenceMs: 9_000 },
      { file: "korhogo-2.wav" },
      { silenceMs: 22_000 },
      { file: "korhogo-3.wav" },
    ],
    speechFiles: ["korhogo-1.wav", "korhogo-2.wav", "korhogo-3.wav"],
    generatedFiles: [],
    durationMs: 75_000,
  },

  "V-COUPURE": {
    description:
      "Question longue puis silence : la réponse va jusqu'à son terme — aucune annulation, aucune reconnexion, chaque réponse créée est terminée.",
    stimulus: [{ silenceMs: 1500 }, { file: "long-question.wav" }],
    speechFiles: ["long-question.wav"],
    generatedFiles: [],
    durationMs: 60_000,
  },

  "V-INTERRUPTION": {
    description:
      "Nouvelle demande injectée pendant que SUTA parle : au plus une annulation, l'ancienne réponse ne repart jamais, la nouvelle question devient le seul tour actif.",
    // Timing fixe (limite du faux micro) : long-question (~8 s) se termine
    // vers 9,5 s ; la réponse démarre 1 à 3 s plus tard ; interrupt.wav tombe
    // donc ~3-4 s après le début de la parole de SUTA. Si la réponse tarde et
    // que l'interruption atterrit hors réponse, le check
    // `interruptionPriseEnCompte` échoue explicitement (stimulus à recaler).
    stimulus: [
      { silenceMs: 1500 },
      { file: "long-question.wav" },
      { silenceMs: 6_000 },
      { file: "interrupt.wav" },
    ],
    speechFiles: ["long-question.wav", "interrupt.wav"],
    generatedFiles: [],
    durationMs: 60_000,
  },
};

/** Suites nommées (`--suite core` = les 4 cas de la phase 1). */
export const SUITES = {
  core: ["V-PTBA", "V-REPETITION", "V-BRUIT-TV", "V-SILENCE-30S"],
  memoire: ["V-MEMOIRE-KORHOGO"],
  phase2: ["V-SAFE", "V-CONCRET", "V-MEMOIRE-KORHOGO", "V-COUPURE", "V-INTERRUPTION"],
  all: [
    "V-PTBA", "V-REPETITION", "V-BRUIT-TV", "V-SILENCE-30S",
    "V-SAFE", "V-CONCRET", "V-MEMOIRE-KORHOGO", "V-COUPURE", "V-INTERRUPTION",
  ],
};
