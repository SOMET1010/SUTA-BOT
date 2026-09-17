# SUTA PASS — lot Android : état, versions, recette

Lot 2, 17/09/2026. Référence avant Android : `6925ce5`.

**Objectif du lot** : prouver la chaîne
`action @suta/pass → pont Capacitor → Android réel → résultat`.
Ni Omnilingual, ni dioula vocal : le socle d'abord.

---

## 1. ⛔ L'APK n'a PAS pu être construit dans cet environnement

> Ce n'est ni un bug du projet, ni une approximation de ma part. C'est une
> **politique réseau de l'environnement d'exécution**, et elle est absolue.

### La preuve, reproductible

`dl.google.com` est refusé par le proxy de sortie :

```
$ curl https://dl.google.com/android/repository/repository2-3.xml
curl: (56) CONNECT tunnel failed, response 403
[agent-proxy] dl.google.com:443 — connect_rejected
              (the egress proxy denied the CONNECT (organization policy))
```

Or **deux** choses indispensables n'existent QUE sur cet hôte :

| Ce qui manque | Seule source | Vérifié |
|---|---|---|
| SDK Android (platform 36, build-tools) | `dl.google.com/android/repository` | 403 |
| Plugin Gradle Android `com.android.tools.build:gradle:8.13.0` | `dl.google.com/dl/android/maven2` | 403 |
| Bibliothèques AndroidX (`androidx.core`, `appcompat`…) | idem | 403 |

`maven.google.com` **n'est qu'un redirecteur** vers `dl.google.com` (301), donc
sans effet. Et il n'existe aucune source de repli :

```
com.android.tools.build:gradle:8.13.0   portail Gradle = 404   Maven Central = absent
androidx.core:core:1.17.0               portail Gradle = 404   Maven Central = 404
```

Le build s'arrête exactement là :

```
$ gradle assembleDebug
> Could not GET 'https://dl.google.com/dl/android/maven2/.../...pom'.
  Received status code 403 from server: Forbidden
BUILD FAILED in 26s
```

**Je n'ai pas cherché de contournement** : ni miroir tiers, ni désactivation de
la vérification TLS, ni court-circuit du proxy. Contourner une politique de
sortie n'est pas de mon ressort.

### Ce qu'il faut pour obtenir l'APK

Une machine avec accès à `dl.google.com` (poste de développement ordinaire,
ou CI autorisée), puis :

```bash
npm install
npm run build:pass          # export statique Next → apps/pass/out
npm run pass:sync           # copie vers Android + régénère les greffons Cordova
npm run pass:apk            # → apps/pass/android/app/build/outputs/apk/debug/
```

Le troisième pas est le seul qui échoue ici. Les deux premiers sont verts.

**⚠️ `pass:sync` n'est pas optionnel après un clone** : le dossier
`capacitor-cordova-android-plugins` est exclu du dépôt et regénéré par
`cap sync`. Sans lui, Gradle échoue sur un projet introuvable.

---

## 2. Versions

| Élément | Version | Origine |
|---|---|---|
| Capacitor (core / cli / android) | **8.5.2** | npm, installé et vérifié |
| Plugin Gradle Android (AGP) | **8.13.0** | gabarit Capacitor — **non téléchargeable ici** |
| Gradle | **8.14.3** | wrapper du gabarit ; le Gradle système de ce conteneur est exactement la même version |
| JDK | **21.0.10** (OpenJDK, Ubuntu) | présent |
| `compileSdk` / `targetSdk` | **36** | gabarit Capacitor |
| `minSdk` | **24** (Android 7.0) | gabarit Capacitor |
| Plugin Gradle Kotlin | **2.2.21** | 🔵 choisi par moi — **à confirmer au premier build réel** contre AGP 8.13 |
| `@capacitor/camera` | 8.2.4 | npm |
| `@capacitor/network` | 8.0.1 | npm |
| `@capacitor-community/contacts` | 8.0.0 | npm |

`applicationId` : **`ci.ansut.suta.pass`** · nom affiché : **SUTA PASS**.

**Signature** : aucune. Le lot s'en tient au débogage, conformément à
l'arbitrage du 17/09 — aucun keystore de production dans le dépôt.

---

## 3. Permissions effectivement demandées

| Permission | Pourquoi | Refus |
|---|---|---|
| `INTERNET` | ressources web empaquetées (posée par le gabarit) | — |
| `ACCESS_NETWORK_STATE` | savoir si le terminal est en ligne (utile au lot suivant) | — |
| `READ_CONTACTS` | retrouver un contact par son nom prononcé | `permission_refusee`, message explicite |
| `CAMERA` | prendre une photo | `permission_refusee`, message explicite |

### Deux permissions VOLONTAIREMENT absentes

- **`CALL_PHONE`** — PASS n'émet jamais d'appel. Il ouvre le composeur
  **pré-rempli** (`ACTION_DIAL`) et la personne appuie. C'est la consigne
  « aucune action sensible exécutée silencieusement », et cela évite une
  permission restreinte par Google Play.
- **`QUERY_ALL_PACKAGES`** — la déclaration `<queries>` (`MAIN` + `LAUNCHER`,
  et `DIAL`/`tel`) suffit à lister les applications lançables sur Android 11+,
  sans réclamer une permission que Play restreint fortement.

Aucune permission de stockage : la photo n'est pas enregistrée dans la galerie
à ce stade (`saveToGallery: false`).

---

## 4. Architecture — où vit quoi

```
@suta/pass (lot 1)          routage, schémas, contrat  — inchangé, source unique
        │  ActionPass validée
        ▼
apps/pass/src/lib/bridge/
  adaptateurs.ts   l'interface des 4 accès plateforme
  pont.ts          TOUTES les décisions — permissions, homonymes, messages
  correspondance.ts la règle d'appariement
  capacitor.ts     adaptateurs réels    ─┐ seuls ces deux fichiers
  mock.ts          adaptateurs simulés  ─┘ diffèrent entre banc et terminal
        ▼
android/.../SutaVolumePlugin.kt    AudioManager
android/.../SutaLauncherPlugin.kt  PackageManager + ACTION_DIAL
```

**Le point important** : `pont.ts` est écrit UNE fois et tourne à l'identique
au banc et sur le téléphone. Les tests exercent donc les décisions réelles, pas
une imitation. Ce qui reste à vérifier sur terminal se réduit aux adaptateurs
et aux deux greffons Kotlin.

**Aucune logique métier en Kotlin** : le Kotlin ÉNUMÈRE (applications) et
EXÉCUTE sur une cible désignée (un paquet, un numéro). Il ne choisit rien. Le
seul type du contrat du lot 1 qui descende jusqu'à lui est `ReglerVolume`, dont
les quatre valeurs de `sens` sont celles de `packages/pass/src/actions.ts` ;
toute autre forme est refusée.

---

## 5. Ce qui est vérifié au banc

29 tests neufs dans `apps/pass`, qui exercent `pont.ts` — le code du téléphone.

| Propriété | Test |
|---|---|
| Un homonyme n'est jamais choisi | `ouvrirComposeur` n'est PAS appelé, le résultat nomme les candidats |
| Un même nom, deux numéros → ambigu | idem, message « a plusieurs numéros » |
| Un doublon strict n'est pas une ambiguïté | un seul numéro → appel préparé |
| Une correspondance exacte prime | « Awa » ne se perd pas dans « Awa Koné » / « Awa Traoré » |
| Refus de permission = résultat | `permission_refusee`, et le carnet n'est PAS lu |
| Aucune exception ne s'échappe | une exception de greffon devient `annule_par_utilisateur` ou `erreur_interne` |
| Le détail technique n'est jamais énoncé | `message` vide, `detail` journalisé |
| Capacité absente = arrêt avant le greffon | le journal reste vide |
| `assistance` ne descend jamais au pont | journal vide |
| La chaîne complète | « ouvre WhatsApp » → `com.whatsapp` ; « mets le volume à 30 » → `definir:30` |

---

## 6. Recette sur téléphone réel — OBLIGATOIRE

Terminal de référence : **PASS, 4 Go de RAM / 64 Go**. Installer l'APK debug,
ouvrir SUTA PASS, puis dérouler cette liste et consigner chaque résultat.

### Préalables
- [ ] L'APK s'installe (source inconnue autorisée)
- [ ] L'application s'ouvre sur le banc technique
- [ ] La bande « Capacités » affiche **quatre ✓** (si un ✗ apparaît, le greffon correspondant n'est pas enregistré — vérifier `MainActivity`)

### Le pont, action par action
- [ ] **Volume — monter / baisser** : le curseur système apparaît, le son change
- [ ] **Volume — couper** : le flux média passe à zéro
- [ ] **Volume — définir 30** : le curseur se place à ~30 %
- [ ] **Ouvrir — « WhatsApp »** : l'application s'ouvre
- [ ] **Ouvrir — « Photoshop »** (absente) : « Je ne trouve pas… », rien ne s'ouvre
- [ ] **Ouvrir — un préfixe ambigu** (ex. « Orange » avec deux applications Orange) : les candidats sont proposés, **rien ne s'ouvre**
- [ ] **Photo arrière** puis **avant** : l'appareil s'ouvre, la photo revient
- [ ] **Photo — annuler** : résultat `annule_par_utilisateur`, pas `erreur_interne` ⚠️ *(le point le plus incertain, cf. §7)*
- [ ] **Appel — contact unique** : le composeur s'ouvre **pré-rempli**, l'appel n'est **PAS** lancé
- [ ] **Appel — homonyme** : les noms sont proposés, **le composeur ne s'ouvre pas**
- [ ] **Appel — contact absent** : « Je ne trouve personne… »

### Permissions
- [ ] Premier appel : la boîte `READ_CONTACTS` apparaît
- [ ] **Refuser** : message explicite renvoyant aux réglages, l'application ne tombe pas
- [ ] Accorder ensuite dans les réglages : l'appel fonctionne
- [ ] Même séquence pour `CAMERA`
- [ ] Refus définitif (« ne plus demander ») : toujours un message, jamais un plantage

### Chaîne complète, sans ASR
- [ ] « appelle Awa » → routé, confirmation demandée, composeur après « Oui »
- [ ] « appelle Awa » → **« Non »** : rien ne se passe
- [ ] « ouvre WhatsApp » → s'ouvre
- [ ] « monte le son » → monte
- [ ] « prends une photo » → appareil photo
- [ ] « quel temps fait-il » → refusé, **aucune action**

---

## 7. Ce qui reste impossible à confirmer sans téléphone

| # | Point | Risque |
|---|---|---|
| 1 | **Le code Kotlin n'a jamais été compilé.** Aucun compilateur Kotlin ni SDK Android ici. | Moyen — erreurs de compilation possibles au premier build |
| 2 | **La compatibilité Kotlin 2.2.21 ↔ AGP 8.13.0** n'est pas vérifiée | Faible — à ajuster si Gradle proteste |
| 3 | **L'enregistrement des greffons** (`registerPlugin` avant `super.onCreate`) n'est pas observé | Faible — c'est la voie documentée |
| 4 | **La traduction des erreurs de greffon** (`codeDepuisErreur`) repose sur des libellés non contractuels. L'annulation de la caméra rend-elle vraiment `annule_par_utilisateur` ? | **Le plus incertain** — au pire imprécis, jamais dangereux |
| 5 | **`setStreamVolume` et la politique « Ne pas déranger »** : le `SecurityException` est capté, mais jamais provoqué en vrai | Faible |
| 6 | **La visibilité des paquets** (`<queries>`) sur Android 11+ : la liste est-elle complète ? | Moyen |
| 7 | **Les libellés d'applications** varient selon la langue du système (« Appareil photo » / « Camera ») | Moyen — touche l'appariement |
| 8 | **La taille réelle de l'APK** | — voir §8 |
| 9 | **Le comportement sur 4 Go de RAM** : démarrage, fluidité de la WebView | Inconnu |

---

## 8. Taille de l'APK

**Non mesurable ici** — l'APK n'existe pas (§1).

Le seul chiffre certain est celui des ressources web qui y entreront :

```
android/app/src/main/assets/public   940 314 octets (0,90 Mo), 27 fichiers
```

Le reste — runtime Capacitor, AndroidX, greffons — ne peut pas être pesé sans
les artefacts Google. **Je ne donne pas d'estimation** : ce serait un chiffre
inventé, et ce projet en a assez vu.

---

## 9. Aucune conclusion sur Omnilingual embarqué

Ce lot n'apporte **aucun élément** sur la faisabilité d'Omnilingual ASR sur le
terminal. La question reste ouverte et sera mesurée séparément, sur l'appareil.
Rien ici ne doit être cité comme un argument dans un sens ou dans l'autre.
