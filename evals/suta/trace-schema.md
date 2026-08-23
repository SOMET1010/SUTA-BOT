# Schéma de trace par tour

Chaque test doit pouvoir être reconstruit sans enregistrer le contenu audio brut.

## Identifiants

- `session_id`
- `turn_id`
- `case_id`
- `git_sha`
- `deployment_id`
- `voice`
- `barge_in_mode`

## Événements horodatés

- `user_speech_started`
- `user_speech_stopped`
- `user_transcript_done`
- `response_created`
- `assistant_audio_started`
- `assistant_transcript_done`
- `tool_call_started`
- `tool_call_finished`
- `response_cancel_sent`
- `response_done`
- `session_created`
- `session_disconnected`

## Compteurs dérivés

- nombre de `response_created` par tour ;
- nombre de `search_knowledge` par tour ;
- nombre de `response_cancel_sent` ;
- nombre de sessions Realtime créées ;
- latence transcription → première réponse ;
- latence outil ;
- durée audio réponse ;
- nombre de segments audio ;
- durée entre deux segments d’une même réponse.

## Invariants attendus

Pour un tour simple avec une recherche :

- 1 transcription utilisateur complète ;
- 1 appel `search_knowledge` maximum sauf justification explicite ;
- 1 résultat d’outil consommé ;
- 1 réponse finale audible ;
- 0 `response_cancel_sent` si l’utilisateur reste silencieux ;
- 0 nouvelle session Realtime pendant le tour ;
- 0 duplication de réponse.

Pour une question ne nécessitant pas de données externes :

- 0 appel outil ;
- 1 réponse.

Pour une interruption réelle :

- 1 `response_cancel_sent` maximum ;
- l’ancienne réponse ne reprend pas ensuite ;
- la nouvelle question devient le seul tour actif.
