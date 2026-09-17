# SUTA PASS V1 — plan de modification du dépôt

> **Statut : PROPOSITION, non validée.** Aucune ligne de code n'est écrite tant que
> Patrick n'a pas tranché les arbitrages du §8. Document rédigé le 17/09/2026 après
> lecture du dépôt.

**Périmètre produit V1** : français + dioula + baoulé.
**Démarrage technique** : dioula seul.
**Première tranche** : 5 intentions — appeler un contact, ouvrir une application,
régler le volume, prendre une photo, aide / répète / stop.

---

## 0. Ce que j'ai trouvé dans le dépôt

Monorepo npm workspaces, **Next.js 16.3.1 / React 19.2.8 / TypeScript**.
7 paquets (`shared`, `ai`, `database`, `auth`, `tools`, `knowledge`, `observability`)
et une seule application, `apps/web`. Tests : vitest en unitaire, Playwright en e2e.

> ⚠️ **Il n'y a pas une ligne d'Android dans ce dépôt.** Pas de Capacitor, pas de
> React Native, pas de Gradle, pas de Kotlin, pas même un manifeste PWA. SUTA est
> aujourd'hui une application web servie par un serveur Next.js.

Ce n'est pas un détail d'intendance : **quatre des cinq intentions demandées sont
impossibles dans un navigateur**, quelle que soit la qualité du code.

| Intention | Faisable en web ? | Ce qu'il faut réellement |
|---|---|---|
| Appeler un contact | ❌ Partiellement. `tel:` ouvre le composeur, mais le carnet d'adresses est inaccessible. | Natif : `READ_CONTACTS` + `CALL_PHONE` |
| Ouvrir une application | ❌ Non. Impossible depuis une page web. | Natif : `PackageManager.getLaunchIntentForPackage` |
| Régler le volume | ❌ Non, définitivement. Aucune API web ne pilote le volume système. | Natif : `AudioManager` |
| Prendre une photo | ❌ Partiellement. `getUserMedia` capture une image, mais rien ne l'enregistre dans la galerie. | Natif : `CameraX` ou intent `MediaStore` |
| Aide / répète / stop | ✅ Oui, entièrement. | Rien — pure logique conversationnelle |

**Conclusion : SUTA PASS exige une coquille native.** C'est le premier arbitrage
(§2), et il conditionne tout le reste du plan.

---

## 1. Le second blocage : le dioula hors ligne

> ⚠️ **« 5 intentions hors ligne en dioula » n'est pas atteignable en V1.**

La raison est documentée dans le dépôt lui-même. `apps/web/src/lib/langues/labo-langues.ts`
le dit noir sur blanc : le service de transcription *« n'existe pas encore : il sera
hébergé par l'équipe sur Azure après la migration (prérequis GPU) »*. Omnilingual
ASR ne tourne pas sur un téléphone. Et le `SpeechRecognizer` d'Android ne connaît
pas le dioula — ni en ligne, ni hors ligne.

Il n'existe donc **aucune oreille dioula embarquable** aujourd'hui. L'audit
linguistique (`SUTA-LANGUES/docs/suta-vision-perimetre.md`) ne fait que confirmer :
ce qui est libre est liturgique, ce qui est vivant est malien, et rien de tout cela
n'est un modèle qui tient dans 200 Mo sur un smartphone d'entrée de gamme.

### Les trois options, et ma recommandation

| | Option | Ce qu'on obtient en V1 | Coût | Risque |
|---|---|---|---|---|
| **A** ✅ **recommandée** | **Français hors ligne, dioula en ligne** | La chaîne complète validée sur vrai téléphone, tout de suite. `SpeechRecognizer` fr-FR fonctionne hors ligne avec le pack de langue installé. Le dioula passe par le service SUTA-LANGUES quand le réseau est là. | Faible | Faible. On sait que ça marche. |
| **B** | **Dioula hors ligne par grammaire de commandes** | Un détecteur de mots-clés dioula embarqué, sur un vocabulaire fermé de 5 commandes. | Élevé — **exige la collecte d'abord** : ~80 énoncés × 5 intentions = **400 énoncés** auprès de vraies locutrices, puis entraînement d'un petit classifieur. | Élevé. Rien ne démarre avant la collecte. Plusieurs semaines. |
| **C** | **Dioula différé** | On enregistre hors ligne, on transcrit quand le réseau revient. | Moyen | **Absurde pour le produit** : « règle le volume » exécuté trois heures plus tard n'a aucun sens. |

**Je recommande A**, et je propose de traiter B comme le **lot 4**, une fois la
collecte faite. Cela respecte ta consigne « le baoulé ne doit pas bloquer le premier
prototype » — appliquée ici au dioula hors ligne, pour la même raison.

Autrement dit : **le dioula reste la première langue locale**, comme tu l'as décidé.
Il arrive simplement en ligne avant d'arriver hors ligne.

---

## 2. La coquille Android — trois options

| | Option | Réutilisation du code SUTA | Effort | Verdict |
|---|---|---|---|---|
| **A** ✅ **recommandée** | **Capacitor** — WebView + ponts natifs | **Maximale.** Tout le TypeScript, les paquets partagés, les tests vitest existants. | Moyen | Le meilleur rapport. On garde l'équipe sur une seule pile. |
| **B** | **React Native / Expo** | Partielle : seule la logique pure se réutilise, toute l'UI est à réécrire. | Élevé | Plus « natif », mais on jette l'interface. |
| **C** | **Kotlin natif** | Quasi nulle. | Très élevé | Hors sujet pour une V1. |

### Pourquoi Capacitor tient ici

Les API routes de Next.js (`/api/realtime/session`, `/api/tools/*`) sont **côté
serveur** et ne s'exportent pas en statique. On ne peut donc pas empaqueter
`apps/web` tel quel. **Ce n'est pas un problème, c'est même l'architecture qu'on
veut** : PASS a besoin d'un front minimal, statique, qui décide localement et
n'appelle le serveur que pour ce qui l'exige vraiment.

D'où la structure proposée : **une nouvelle application `apps/pass`**, exportable en
statique, empaquetée par Capacitor, qui réutilise les paquets TypeScript du monorepo
et appelle l'API de `apps/web` déployée **uniquement** quand le réseau est là.

---

## 3. La séparation du mode PASS

Calquée **exactement** sur le mécanisme de `SUTA_MODE=cockpit` introduit par
`46bd95c` — c'est le composant que tu as identifié comme réutilisable, et il l'est.

Deux axes de séparation :

**Côté serveur** — `SUTA_MODE=pass`
- prompt système PASS dédié, jamais servi à l'instance citoyenne ni au cockpit ;
- outils PASS exclusivement : **aucun outil citoyen exposé**, et réciproquement
  la route des outils PASS répond **404** sur les autres instances ;
- variable absente = comportement citoyen strictement inchangé.

**Côté client** — `apps/pass`
- son propre routeur d'intentions, **déterministe et local**, qui tourne dans la
  WebView sans réseau ;
- ses propres ponts natifs ;
- ses propres règles hors ligne / en ligne.

> **Les intentions citoyennes ne sont pas réutilisées.** `couverture`, `operateurs`,
> `formation`, `equipement`, `projets`, `hors_domaine` restent où elles sont. Ce que
> PASS reprend d'`intentions.ts`, c'est **le patron**, pas le contenu :
> un module unique, sans modèle dans la boucle, où l'ordre des tests porte les
> leçons de terrain et où chaque décision est reproductible au banc. C'est
> précisément ce patron qui permet de décider **hors ligne**.

---

## 4. Fichiers réutilisés

| Fichier | Usage pour PASS |
|---|---|
| `apps/web/src/lib/cockpit/contrat.ts` → `modeCockpitActif` | **Patron copié**, pas importé. Donne `modePassActif(env)`. |
| `apps/web/src/app/api/realtime/session/route.ts` | **Modifié** : la bascule binaire cockpit/citoyen devient une bascule à trois voies. |
| `packages/ai/src/prompts/index.ts` | **Modifié** : ajout de `loadPassSystemPrompt()`. |
| `packages/tools/src/types.ts` | **Importé tel quel.** `ToolDefinition`, `describeTool`, `runTool`, `ToolInputError` — la validation zod des entrées d'outil se reprend sans changement. |
| `apps/web/src/lib/realtime/intentions.ts` | **Patron de référence**, aucune ligne copiée. |
| `apps/web/src/lib/suta/actions-citoyennes.ts` | **Patron de référence** : parcours courts, déterministes, module pur sans React, testable unitairement. |
| `packages/shared/src/conversation-state.ts` | **À évaluer** au lot 1 — potentiellement réutilisable pour le fil de conversation PASS. |
| `.env.example` | **Modifié** : bloc PASS, sur le modèle du bloc Cockpit. |

---

## 5. Nouveaux fichiers

### Paquet d'intentions PASS — `packages/pass/`
```
packages/pass/src/intentions.ts      Le routeur local : 5 intentions + hors_domaine.
                                     Déterministe, aucun modèle. Motifs fr ET dyu.
packages/pass/src/actions.ts         Les 5 actions et leurs schémas zod (ToolDefinition).
packages/pass/src/confirmation.ts    Les phrases de confirmation et de refus, fr + dyu.
packages/pass/src/index.ts
packages/pass/package.json | tsconfig.json | vitest.config.ts
```

### Application PASS — `apps/pass/`
```
apps/pass/src/app/page.tsx           Écran unique : écoute, transcription, action.
apps/pass/src/lib/bridge/index.ts    Contrat des ponts natifs — INTERFACE seule.
apps/pass/src/lib/bridge/capacitor.ts   Implémentation Capacitor.
apps/pass/src/lib/bridge/mock.ts     Implémentation de test, pour vitest et Playwright.
apps/pass/src/lib/ecoute.ts          Reconnaissance vocale : natif hors ligne (fr),
                                     service SUTA-LANGUES en ligne (dyu).
apps/pass/src/lib/reseau.ts          Détection en ligne / hors ligne et dégradation.
apps/pass/next.config.ts             output: "export"
apps/pass/capacitor.config.ts
apps/pass/package.json | tsconfig.json
```

### Côté serveur — mode PASS
```
packages/ai/src/prompts/pass-system.ts        Prompt système PASS.
apps/web/src/lib/pass/mode.ts                 modePassActif(env) + garde 404.
apps/web/src/app/api/pass/transcrire/route.ts Relais vers SUTA-LANGUES (dioula).
```

### Coquille Android
```
apps/pass/android/                            Projet Gradle généré par Capacitor.
apps/pass/android/.../SutaVolumePlugin.kt     Plugin maison — AudioManager.
apps/pass/android/.../SutaLauncherPlugin.kt   Plugin maison — PackageManager.
```

### Documentation
```
docs/pass-architecture.md            L'architecture PASS et ses frontières.
docs/pass-recette-telephone.md       Recette manuelle sur téléphone réel (§6).
```

---

## 6. Dépendances Android et permissions

> ⚠️ **Tous les noms de paquets ci-dessous sont à vérifier avant installation.**
> C'est la règle apprise pendant l'audit : *l'identifiant exact, jamais la devinette*.
> Trois tentatives ont été perdues sur la casse d'un seul identifiant.

| Besoin | Piste | Statut |
|---|---|---|
| Socle | `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` | ✅ Officiel |
| Prendre une photo | `@capacitor/camera` | ✅ Officiel |
| Réseau en ligne / hors ligne | `@capacitor/network` | ✅ Officiel |
| Préférences locales | `@capacitor/preferences` | ✅ Officiel |
| Appeler un contact | `@capacitor-community/contacts` | 🔵 Communautaire — **à vérifier** |
| Reconnaissance vocale native | `@capacitor-community/speech-recognition` | 🔵 Communautaire — **à vérifier**, et vérifier le support **hors ligne** fr-FR |
| Régler le volume | **Aucun plugin fiable.** Plugin maison en Kotlin (`AudioManager`). | 🔧 À écrire |
| Ouvrir une application | **Aucun plugin officiel.** Plugin maison en Kotlin (`PackageManager`). | 🔧 À écrire |

**Permissions du manifeste** : `RECORD_AUDIO`, `READ_CONTACTS`, `CALL_PHONE`,
`CAMERA`, `INTERNET`, `ACCESS_NETWORK_STATE`. Plus la déclaration `<queries>`
d'Android 11+ pour que `PackageManager` voie les applications installées.

**Sensible** : `CALL_PHONE` et `READ_CONTACTS` sont des permissions à risque au sens
de Google Play. Elles exigent une justification à la publication. À instruire
**avant** le dépôt sur le Store, pas après — ce n'est pas bloquant pour un APK de
test.

**Non traité à ce stade, et à trancher** : la signature de l'APK (keystore), et
l'endroit où il se construit (poste local ou CI). Cf. §8.

---

## 7. Tests à créer

**Unitaires (vitest)** — `packages/pass/tests/`
- `intentions.test.ts` : les 5 intentions reconnues en français **et en dioula** ;
  le hors-domaine correctement rejeté ; l'ordre de détection verrouillé par un test
  (comme `intentions.test.ts` verrouille « formation avant équipement »).
- `actions.test.ts` : les schémas zod acceptent l'entrée valide, rejettent le reste.
- `confirmation.test.ts` : chaque action confirme avant d'agir, dans la bonne langue.

**Unitaires** — `apps/pass/tests/unit/`
- `bridge-mock.test.ts` : le contrat des ponts natifs, sans téléphone.
- `ecoute.test.ts` : la bascule natif-hors-ligne / service-en-ligne.
- `reseau.test.ts` : la dégradation quand le réseau tombe en cours d'action.

**Unitaires** — `apps/web/tests/unit/`
- `pass-mode.test.ts` : `SUTA_MODE=pass` sert le prompt PASS et **aucun** outil
  citoyen ; la route PASS répond **404** hors mode PASS.

**Non-régression — la condition de recette du lot 1**
- Les tests existants (**243 selon le message de `46bd95c`, à revérifier au premier
  `npm test`**) doivent rester verts avec `SUTA_MODE` absent. C'est la garantie que
  l'instance citoyenne et le cockpit ne bougent pas d'un pouce.

**e2e (Playwright)** — `apps/pass/tests/e2e/`
- Le parcours complet en navigateur, ponts natifs simulés.

**Recette manuelle sur téléphone réel** — `docs/pass-recette-telephone.md`
- Les 5 intentions, en mode avion puis connecté, avec les résultats consignés.
- ⚠️ **Je ne peux pas automatiser ceci.** Ce conteneur n'a pas de téléphone. Il faut
  quelqu'un devant l'appareil, un APK installé, et une fiche de recette remplie.

---

## 8. Ce que j'attends de toi avant d'écrire une ligne

| # | Arbitrage | Ma recommandation |
|---|---|---|
| 1 | **Le dioula hors ligne (§1)** — option A, B ou C ? | **A** : français hors ligne + dioula en ligne en V1, dioula hors ligne au lot 4 après la collecte. |
| 2 | **La coquille Android (§2)** — Capacitor, React Native ou Kotlin ? | **Capacitor** : réutilisation maximale, une seule pile pour l'équipe. |
| 3 | **Le téléphone de test** — quel modèle, quelle version d'Android, et **qui l'a en main** ? | Je ne peux pas tester d'ici. Il me faut une personne devant l'appareil. |
| 4 | **Construction et signature de l'APK** — poste local ou CI ? Où vit le keystore ? | À trancher avant le lot 3. |

Une fois ces quatre points tranchés, je propose le séquencement suivant :

- **Lot 1** — mode PASS côté serveur + `packages/pass` + tests. Aucun Android.
  Vérifiable entièrement au banc, et non-régression des 243 tests prouvée.
- **Lot 2** — `apps/pass` et le contrat des ponts natifs, en simulation.
  Parcours complet jouable dans un navigateur.
- **Lot 3** — Capacitor, les deux plugins Kotlin maison, premier APK, recette réelle.
- **Lot 4** — dioula hors ligne, après collecte des ~400 énoncés.

Le lot 1 ne dépend d'**aucun** des quatre arbitrages. Si tu veux gagner du temps,
je peux le démarrer dès ton feu vert sur le principe, pendant que les trois autres
points se règlent.
