# Protocole de mesure de la production SUTA

> **Pourquoi ce document.** Le 02/09, Patrick a constaté que « la quantité
> d'écoute et de réponses vocales a beaucoup baissé ». La campagne de mesure
> n'a **jamais pu s'exécuter** : l'environnement d'agent bloquait l'accès
> réseau vers la production. Le document de passation (§8.1) en fait la
> **première action recommandée**. Elle est toujours ouverte.
>
> Le blocage est constant : au 20/09, `suta-bot-web.vercel.app` reste refusé
> par le proxy de sortie des conteneurs d'agent. Ce protocole est donc écrit
> pour être exécuté **depuis un poste ordinaire**, à la main.

Cible : **https://suta-bot-web.vercel.app**

---

## La logique du diagnostic

Trois chemins peuvent expliquer « SUTA écoute et répond moins ». Les sondes
sont ordonnées pour les **séparer**, du moins cher au plus cher :

```
Phase A  (5 min, navigateur + PowerShell)
  A1  version déployée ........ teste-t-on bien ce qu'on croit ?
  A2  /api/health ............. le service se déclare-t-il prêt ?
  A3  search-knowledge × 3 .... le corpus répond-il encore ?
         │
         ├── A2 ou A3 en défaut → le problème est dans la CONNAISSANCE.
         │                        Inutile d'aller plus loin.
         └── A2 et A3 verts     → le problème est dans la VOIX.
                                  Passer à la phase B.

Phase B  (30 min, dépôt + Chromium)
  B    banc vocal ............. vraie page, vrai WebRTC, faux micro
```

C'est exactement ce que la revue d'architecture de Diakité reprochait au
système : mélanger des voies au lieu de les départager. On ne va pas refaire
l'erreur dans la mesure.

---

## Phase A — cinq minutes, sans dépôt ni git

### A1. Quelle version tourne réellement

Ouvre **https://suta-bot-web.vercel.app** dans un navigateur et lis le
**pied de page** : il affiche `v-<sha court>` du commit déployé.

Note ce SHA. Sans lui, tout le reste mesure une inconnue.

Attendu : `v-46bd95c` (tête de `feature/suta-experience`) ou plus récent.
Un SHA plus ancien signifie qu'un déploiement a échoué, et **c'est peut-être
déjà l'explication de la régression**.

### A2. Le service se déclare-t-il prêt

```powershell
Invoke-RestMethod -Uri "https://suta-bot-web.vercel.app/api/health" | ConvertTo-Json -Depth 5
```

La réponse porte un `status` et six contrôles. Ce qu'ils veulent dire :

| Champ | Vert signifie |
|---|---|
| `status` | `ready` · `degraded` = fonctionne en mode secours · `unavailable` = à terre |
| `realtime` | le fournisseur vocal Azure est configuré — **le plus important ici** |
| `rechercheCorpus` | l'Edge Function Supabase répond (chemin de production) |
| `database` · `knowledgeLoaded` | le chemin Prisma de secours |
| `corpusComplet` | `documents ≥ 1000` — **faux = base d'amorçage fictive** |
| `documents` | ordre de grandeur attendu : plusieurs milliers |

⚠️ **`corpusComplet: false` est le piège du salon** : tous les contrôles
passent, et SUTA répond depuis les documents de démonstration.

### A3. Le corpus répond-il encore

Trois sondes, choisies pour emprunter les deux voies de recherche que la revue
d'architecture distingue — géographique exacte, puis vectorielle.

```powershell
$u = "https://suta-bot-web.vercel.app/api/tools/search-knowledge"
@("Est-ce que Lakota est connecté ?", "Quels opérateurs couvrent Korhogo ?", "Qu'est-ce que le PTBA ?") | ForEach-Object {
  $r = Invoke-RestMethod -Uri $u -Method Post -ContentType "application/json" -Body (@{ query = $_ } | ConvertTo-Json)
  "{0,-40} {1} résultat(s)  |  {2}" -f $_, $r.results.Count, ($r.results[0].title)
}
```

Attendu : **au moins un résultat par sonde**, avec un titre plausible.
Zéro résultat sur les trois = le corpus ou la recherche est en cause, et la
phase B est inutile pour l'instant.

> ⛔ **Ne PAS sonder `signaler-zone` ni `point-connecte`.** Ces outils écrivent
> et lisent de vrais signalements (passation §8.7). Les appeler contre la
> production pollue les données.

---

## Phase B — le banc vocal

À faire **seulement si la phase A est verte**, c'est-à-dire si le problème est
bien dans la voix.

Le banc pilote la **vraie page** dans Chromium avec un faux micro alimenté par
des WAV figés, établit une **vraie session WebRTC** avec Azure Realtime, et
mesure écoute, réponse et temps de réaction. Ce n'est pas un simulateur de
texte.

### Prérequis

| | |
|---|---|
| Node | ≥ 20 — aucune dépendance à installer, `playwright-core` vient du monorepo |
| Dépôt | cloné, `npm install` passé une fois |
| Chromium | **sur Windows**, il faut le désigner : le runner ne connaît que des chemins Linux |

Sur Windows, Edge convient — il est basé sur Chromium et accepte les mêmes
options :

```powershell
$env:CHROMIUM_PATH = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
```

Ou Chrome, s'il est installé :
`C:\Program Files\Google\Chrome\Application\chrome.exe`

### La commande

```powershell
node evals/suta/vocal-qa/run.mjs --url https://suta-bot-web.vercel.app --suite core --footer-sha-min 46bd95c
```

`--footer-sha-min` fait refuser le banc si le déploiement servi est plus ancien
que ce commit : on ne mesure pas une version fantôme.

### Les quatre cas de la suite `core`

Verte le 23/08, avec trois exécutions réelles versionnées dans
`evals/suta/vocal-qa/results/`. C'est la **référence de comparaison** : si un
cas qui passait le 23/08 échoue aujourd'hui, la régression est établie, datée,
et localisée.

| Cas | Ce qu'il éprouve |
|---|---|
| `V-PTBA` | question simple → SUTA écoute, cherche, répond |
| `V-REPETITION` | on redemande — SUTA se répète-t-il sans se perdre |
| `V-BRUIT-TV` | fond sonore — le barge-in se déclenche-t-il à tort |
| `V-SILENCE-30S` | trente secondes de silence — SUTA reste-t-il stable |

La suite `phase2` sort en `SKIPPED_MISSING_STIMULUS` : ses WAV de parole n'ont
jamais été enregistrés (passation §8.3). Ne pas s'en inquiéter.

⚠️ **Ne jamais régénérer les stimuli existants**, et jamais de synthèse vocale
dans la boucle de test : la comparaison avec le 23/08 n'aurait plus de sens.

---

## Ce qu'on saura en sortie

| Résultat | Conclusion |
|---|---|
| A1 montre un SHA ancien | Un déploiement a échoué. Cause probable trouvée. |
| A2 `realtime: false` | La clé Azure est absente ou expirée. **Cause la plus probable d'une baisse d'écoute.** |
| A2 `corpusComplet: false` | La base servie n'est pas celle du corpus. Piège du salon. |
| A3 zéro résultat | Corpus ou recherche en cause, la voix est hors de question. |
| A vert, B rouge | La régression est dans la voix. Comparer cas par cas au 23/08. |
| A vert, B vert | **Rien n'a régressé techniquement.** L'impression venait d'ailleurs — et c'est une réponse aussi utile que les autres. |

Consigner le résultat dans `evals/suta/vocal-qa/rapports/`, daté, quel qu'il
soit. Un résultat négatif consigné vaut mieux qu'une inquiétude qui dure
dix-sept jours.
