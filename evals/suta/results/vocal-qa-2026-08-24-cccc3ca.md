# Vocal QA — 2026-08-24 — cccc3ca

- URL testée : https://suta-bot-web.vercel.app
- Footer : v-cccc3ca (attendu : 30e5c5a)
- Cas joués : 9

| Cas | Verdict | Premier défaut / observation |
|---|---|---|
| V-PTBA | PASS | Tous les critères mesurés sont conformes. |
| V-REPETITION | FAIL | Premier défaut : aucunAudioApresFin. |
| V-BRUIT-TV | PASS | Tous les critères mesurés sont conformes. |
| V-SILENCE-30S | PASS | Tous les critères mesurés sont conformes. |
| V-SAFE | PASS | Tous les critères mesurés sont conformes. |
| V-CONCRET | PASS | Tous les critères mesurés sont conformes. |
| V-MEMOIRE-KORHOGO | PASS | Non mesurable : tour3ConserveKorhogo. |
| V-COUPURE | PASS | Tous les critères mesurés sont conformes. |
| V-INTERRUPTION | PASS | Tous les critères mesurés sont conformes. |

Légende des verdicts : PASS / FAIL (mesuré), SKIPPED_MISSING_STIMULUS (WAV de parole à enregistrer — voir evals/suta/audio/README.md), REFUSED_WRONG_BUILD (footer ≠ SHA attendu), ERROR_ENV (session vocale impossible depuis cet environnement — à rejouer sur un poste avec accès Realtime).

Un critère `null` dans le JSONL est **non mesurable** sur ce run — jamais compté comme un succès ni converti en score.
