# Vocal QA Agent — runner (phase 1)

Automatisation de la campagne vocale SUTA (spec complète :
`docs/vocal-qa-agent.md`). Le runner teste le **vrai** chemin
navigateur + Realtime + audio — ce n'est pas un simulateur de texte.

Cas couverts en phase 1 : `V-PTBA`, `V-REPETITION`, `V-BRUIT-TV`,
`V-SILENCE-30S` (= suite `core`).

## Prérequis

- Node ≥ 20 — aucune dépendance à installer : `playwright-core` est résolu
  depuis le `node_modules` du monorepo.
- Un binaire Chromium. Ordre de résolution : `CHROMIUM_PATH`, puis le
  registre Playwright, puis `/opt/pw-browsers/chromium` et les chemins
  système habituels (`/usr/bin/chromium`, `google-chrome`…).
- Les stimuli audio (voir `evals/suta/audio/README.md`) :
  - synthétiques : `python3 evals/suta/audio/gen_stimuli.py` ;
  - parole (`ptba.wav`, `pass.wav`…) : à enregistrer à la main — tant qu'ils
    manquent, les cas concernés sortent en `SKIPPED_MISSING_STIMULUS`
    (**attendu** tant que les fixtures ne sont pas livrées).

## Usage

```bash
node evals/suta/vocal-qa/run.mjs --url https://<deployment> --suite core
node evals/suta/vocal-qa/run.mjs --url https://<deployment> \
    --case V-PTBA --case V-BRUIT-TV \
    --footer-sha-min 0e31400 --headed --keep-artifacts
```

| Option | Effet |
|---|---|
| `--url <URL>` | Déploiement SUTA à tester (obligatoire). |
| `--case <ID>` | Joue ce cas (répétable). Sans `--case` : la suite. |
| `--suite core` | Suite nommée (défaut : `core`). |
| `--footer-sha-min <sha>` | Refuse la campagne (`REFUSED_WRONG_BUILD`) si le hash du footer (`v-<hash>`) ne correspond pas à ce préfixe. |
| `--headed` | Chromium visible (phase 1 : recommandé pour valider le protocole). |
| `--keep-artifacts` | Sauve les événements bruts par cas dans `results/artifacts/…/<cas>/events.json` + le WAV composé. |
| `--out-dir <dir>` | Dossier de sortie (défaut : `evals/suta/results/`). |

Variable utile : `SUTA_VOCALQA_AUDIO_DIR` remplace le corpus audio (tests).

## Ce que fait le runner, par cas

1. **Session navigateur neuve** — le WAV du faux micro est un flag de
   lancement Chromium, impossible d'en changer sans relancer le navigateur.
   Flags : `--use-fake-device-for-media-stream`,
   `--use-fake-ui-for-media-stream`,
   `--use-file-for-fake-audio-capture=<wav>%noloop`,
   `--autoplay-policy=no-user-gesture-required` (plus `--no-sandbox` /
   `--disable-dev-shm-usage` pour conteneur/CI).

   **`%noloop` est indispensable** : sans lui Chromium reboucle le fichier et
   la question rejouée en boucle fabrique des tours utilisateur fantômes —
   tous les verdicts deviendraient faux. Avec, la fin du fichier = silence.
2. **Footer** — lit `v-<hash>` dans le `<footer>` ; avec `--footer-sha-min`,
   un hash différent refuse le cas (`REFUSED_WRONG_BUILD`) sans le jouer.
3. **Capture avant toute interaction** — console (`[suta:voix]`, horodatée en
   relatif), réseau (`/api/realtime/session`, `/api/tools/search-knowledge` :
   méthode, statut, requête `query` ; **jamais** le contenu des réponses —
   seulement les titres des résultats, convention anti-ADMIN du repo).
4. **Clic sur l'orbe** (bouton « Activer le microphone… ») : le faux micro
   joue alors le WAV composé du scénario (question + pauses + bruit dans un
   seul fichier — limite du flag Chromium ; composition en mémoire par le
   runner, mêmes règles que `evals/suta/audio/compose.py`).
5. **Observation à durée fixe** (45-60 s selon le cas) : échantillonnage du
   transcript DOM (bulle courante + historique « Vous : / SUTA : ») +
   collecte des événements `[suta:voix]`.
6. **Métriques** : `searchKnowledge`, `responseCreate`, `responseDone`,
   `responseCancel` (envoyés), `newSessions`, `speechStartedPendantReponse` ;
   **détections** : `duplicate_tool_calls`, `unexpected_cancel`,
   `ghost_turn_after_silence`, `background_noise_triggered_turn`,
   `assistant_sentence_repetition` (phrase ≥ 6 mots répétée).

   Nota : après un tool call, un `response.create` de **continuation** est
   normal (created → function_call → done → created → done). L'anomalie
   mesurée est l'excédent (`responseCreate > searchKnowledge + 1`) ou deux
   réponses parlées (`transcript terminé` × 2), ou deux recherches identiques.

## Sorties

- `evals/suta/results/vocal-qa-<date>-<sha>.jsonl` — une ligne par cas
  (format de la spec §Format de sortie, enrichi d'un champ `detections`).
- `…/vocal-qa-<date>-<sha>.md` — résumé lisible : PASS/FAIL par cas, premier
  défaut, critères **non mesurables** signalés tels quels (un critère `null`
  n'est jamais compté ni converti en score).
- `--keep-artifacts` : `…/artifacts/vocal-qa-<date>-<sha>/<cas>/events.json`
  (événements bruts) + le WAV composé du scénario.

## Verdicts

| Verdict | Signification |
|---|---|
| `PASS` / `FAIL` | Mesuré réellement ; le premier check en échec est nommé. |
| `SKIPPED_MISSING_STIMULUS` | WAV de parole manquant — cas non joué. |
| `REFUSED_WRONG_BUILD` | Footer ≠ `--footer-sha-min` — cas non joué. |
| `ERROR_ENV` | La session vocale ne s'établit pas (pas de réseau vers Azure/Supabase, session « simulée » du provider mock…). Les événements capturés jusqu'au blocage sont conservés. À rejouer depuis un poste avec accès Realtime — le runner ne fait jamais semblant. |

Code retour : `1` si au moins un `FAIL`/`REFUSED_WRONG_BUILD`, `2` sur erreur
fatale du runner, `0` sinon (y compris `SKIPPED`/`ERROR_ENV`, qui ne sont pas
des verdicts de qualité).

## Limites connues (phase 1)

- Pas d'analyse de l'audio SORTANT (doublons acoustiques) : v2, comme prévu
  par la spec.
- Le rôle de la **dernière** bulle du transcript est déduit (historique DOM +
  logs `premier delta`) — fiable dans les scénarios joués, mais signalé ici.
- « Pas de promesse de localité » (V-PTBA) est une heuristique regex
  prudente ; la relecture humaine du transcript reste la référence.
- `--footer-sha-min` compare par préfixe exact — la notion de « descendant
  accepté » (spec) viendra avec l'intégration CI.
- V-SILENCE-30S et V-BRUIT-TV requièrent la question parlée `pass.wav` :
  `SKIPPED_MISSING_STIMULUS` tant qu'elle n'est pas enregistrée — attendu.
