# SUTA PASS — plan d'exécution semaine 1

> Objectif unique : **remplacer des estimations par des mesures sur un vrai
> téléphone Android 4 Go / 64 Go.** À la fin de la semaine, H1 à H4
> (voir `suta-pass-v1-cadrage.md`) sont passées en [MESURÉ] ou tombées.
> Aucune hypothèse embarquée ne devient décision sans ce rapport.

## 0. Périmètre

**Dans la semaine :**
- Chaîne complète **sur le téléphone, en mode avion** : bouton → VAD → ASR →
  intention + paramètres → action Android → réponse.
- **5 intentions** : `APPELER`, `OUVRIR_APP`, `VOLUME`, `LAMPE`,
  `INFO_TELEPHONE` (heure, batterie).
- **2 langues** : français ivoirien + **une** langue locale (dioula ou baoulé,
  selon les locuteurs disponibles lundi).
- **5 familles de mesures** : RAM, taille, latence, batterie, erreurs.
- **Tests annexes courts** : USSD (H3), droits Android (H4).

**Hors semaine :**
- Fine-tuning.
- Serveur online.
- Voix synthétique.
- Nouvel inventaire de modèles.
- Seconde langue locale.
- Collecte à grande échelle.

Pourquoi ces 5 intentions : elles couvrent les trois types de paramètres
(liste fermée dynamique = contacts, liste fermée statique = applis et
gestes, valeur = heure ou niveau). Quatre d'entre elles ne demandent aucun
droit sensible : les erreurs mesurées viennent donc de la chaîne vocale, pas
d'Android. `APPELER` teste en plus une autorisation sensible et la
confirmation.

## 1. Matériel et équipe

| Élément | Détail |
|---|---|
| **Téléphone cible** | Terminal PASS d'entrée. À défaut : Android 4 Go RAM / 64 Go, processeur de gamme équivalente (à confirmer auprès du fabricant PASS) |
| **Téléphone témoin** | Un Android de gamme supérieure, pour distinguer « trop lent sur le 4 Go » et « trop lent partout » |
| **SIM** | Orange, MTN, Moov (une de chaque, pour H3) |
| **Poste** | PC avec Android Studio, `adb` (Wi-Fi adb pour les mesures batterie), accès RunPod |
| **Audio** | Une enceinte pour diffuser un bruit de fond de marché ou de rue enregistré, un sonomètre (ou une appli) pour noter le niveau |
| **Rôles** | **Dev Android** (appli, actions, banc de mesure) ; **ML** (export, quantification, parité, scripts d'analyse) ; **Coordination terrain** (locuteurs, consentements, transcription de référence) |

**Relevé d'identité du téléphone (J1, à consigner dans le rapport) :**

```
adb shell getprop ro.product.model
adb shell getprop ro.board.platform
adb shell getprop ro.build.version.release
adb shell cat /proc/meminfo | grep -E "MemTotal|MemAvailable"
adb shell df -h /data
```

## 2. Jeu de test de la semaine

Les phrases sont **produites par de vrais locuteurs à partir de scénarios,
jamais traduites**. Aucun exemple en langue locale n'est écrit à l'avance.

- **Locuteurs :** 6 par langue (3 hommes, 3 femmes, âges variés, au moins 2
  peu à l'aise avec l'écrit), avec consentement signé ou enregistré et
  rémunération.
- **Scénarios :** 5 intentions × 5 scénarios (ex. « vous voulez appeler votre
  sœur », « il fait nuit, vous cherchez vos clés »). Chaque locuteur dit
  **2 formulations libres** par scénario.
  - Volume : 6 × 25 × 2 = **300 énoncés par langue**.
- **Enregistrement sur le téléphone cible** (16 kHz mono), en deux
  conditions :
  - calme, à 30 cm ;
  - bruit de fond diffusé (niveau consigné), à 50 cm.
- **Répertoire de test** : 150 contacts réalistes, dont les noms appelés dans
  les scénarios et des noms proches (homonymes, prénoms fréquents).
- **Découpage par locuteur :**
  - locuteurs **1–3 = développement** : ils servent à écrire les règles et
    les lexiques ;
  - locuteurs **4–6 = test**, jamais regardés avant J4.
- **Annotation :** intention attendue, paramètres attendus et transcription
  de référence.
  - En langue locale, si l'orthographe est incertaine, noter-le : le CER sera
    indicatif ; la réussite de la tâche reste fiable.

## 3. Journée par journée

### J1 (lundi) : socle et référence

| Qui | Tâche | Sortie |
|---|---|---|
| Dev | Relevé d'identité (§ 1). Mesure **à vide** : RAM disponible après démarrage + applis PASS usuelles ouvertes (WhatsApp, Facebook) | `mesures/j1-socle.csv` |
| Dev | Squelette Kotlin : bouton, enregistrement 16 kHz, Silero VAD, horodatage de chaque étape, **mode fichier** (traite un WAV poussé par `adb`) et **mode micro** | APK v0 |
| ML | Export du 300M CTC → ONNX, quantification INT8 sur RunPod. Vérifier d'abord s'il existe un export sherpa-onnx prêt | `omni300m-int8.onnx` + tailles FP32/INT8 |
| ML | **Parité** : CER FP32 vs INT8 sur 50 énoncés de corpus existants, sur le serveur | Écart de CER |
| Terrain | Recrutement, consentements, séance d'enregistrement **français** | 150 énoncés FR |

### J2 (mardi) : ASR sur le téléphone → point de décision H2

| Qui | Tâche | Sortie |
|---|---|---|
| Dev + ML | Intégration du modèle ONNX dans l'APK (sherpa-onnx Android ou ONNX Runtime Mobile) ; transcription en mode fichier | APK v1 |
| Dev | Premières mesures : temps de chargement à froid, RAM au pic, facteur temps réel sur 20 fichiers | `mesures/j2-asr.csv` |
| Terrain | Séance d'enregistrement **langue locale** | 150 énoncés |

**Point de décision H2, mardi 17 h :**
- **Si l'export échoue ou si le modèle ne se charge pas** sur le téléphone
  → H2 tombe. On ne s'acharne pas au-delà de J3 midi. On déroule quand même
  le reste de la semaine : Omnilingual tourne alors **sur le PC local ou
  RunPod en mode relais**, et les autres mesures (intentions, actions, H3,
  H4) restent valables.
- **Si la parité INT8 dégrade le CER de plus de 3 points** → tester la
  quantification dynamique partielle avant de conclure.

### J3 (mercredi) : intentions et actions

| Qui | Tâche | Sortie |
|---|---|---|
| Dev | Actions Android des 5 intentions ; confirmation B pour `APPELER` (annonce + 3 s pour annuler) ; réponses : TTS système en français, **enregistrements humains** pour les 10 à 15 messages de la langue locale | APK v2 |
| ML | Moteur d'intentions v0 **sans apprentissage** : normalisation, mots-clés et lexiques écrits **à partir des sorties ASR des locuteurs 1–3**, correspondance approximative pour contacts et applis, seuil de confiance → « je n'ai pas compris » | `nlu-v0` embarqué |
| Terrain | Enregistrement des messages de réponse en langue locale ; 2 premières sessions d'enregistrement FR et langue locale terminées | Audio de réponse |

### J4 (jeudi) : campagne de mesure

Tout sur le **téléphone cible**, en **mode avion**, batterie > 80 %,
luminosité fixe, pas en charge pendant les mesures batterie.

| Bloc | Protocole | Durée |
|---|---|---|
| **M1 Latence et RAM, mode fichier** | Les 600 énoncés (dont test = locuteurs 4–6), 1 passage à froid + passages à chaud ; horodatage de chaque étape | 2 h |
| **M2 Bout en bout, mode micro** | 2 locuteurs de test par langue parlent **en direct** au téléphone : 25 scénarios, calme puis bruit. On note l'action **réellement exécutée** | 2 h |
| **M3 Batterie et chaleur** | Session scriptée de 30 min : 1 demande toutes les 30 s (60 demandes), puis 60 min au repos avec SUTA en veille | 1 h 30 |
| **M4 Pression mémoire** | Ouvrir WhatsApp, Facebook, l'appareil photo, puis appeler SUTA : le modèle est-il tué, rechargé ? combien de temps ? | 30 min |
| **A1 USSD (H3)** | Pour chaque SIM : `sendUssdRequest` sur le code de consultation de solde ; SIM 1 et SIM 2 ; noter succès, délai, format de réponse, message d'erreur | 1 h |
| **A2 Droits (H4)** | APK installé hors Play Store : vérifier chaque ligne du tableau § 2.1 du cadrage (appel, journal d'appels, SMS, accessibilité, appel d'urgence **au composeur seulement**, sans le passer) | 1 h |

**Commandes de mesure :**

```
# RAM (pendant et après une demande)
adb shell dumpsys meminfo ci.ansut.suta          # PSS/RSS total, natif
adb shell cat /proc/meminfo | grep MemAvailable
adb logcat -d | grep -iE "lowmemorykiller|lmkd"   # processus tués

# Taille
adb shell pm path ci.ansut.suta                   # puis du -h sur l'APK
adb shell du -sh /data/data/ci.ansut.suta         # modèles + audio

# Batterie et chaleur
adb shell dumpsys batterystats --reset
# … session scriptée, téléphone débranché (adb en Wi-Fi) …
adb shell dumpsys batterystats > batterystats.txt # + Battery Historian
adb shell dumpsys battery                         # niveau, température
adb shell dumpsys thermalservice                  # état thermique / bridage
```

La latence est mesurée **dans l'application** (horodatages monotones), pas
au chronomètre.

### J5 (vendredi) : analyse, rapport, décision

| Qui | Tâche | Sortie |
|---|---|---|
| ML | Calcul des indicateurs (§ 4) sur les locuteurs de test uniquement, par langue et par condition | `rapport-semaine-1.md` + CSV |
| Dev | Relevé des plantages, anomalies et limites Android | Annexe |
| Tous | Revue et **décision H1 à H4** (§ 5) ; mise à jour du cadrage : [HYP] → [MESURÉ] ou hypothèse tombée | Cadrage v1.2 |

## 4. Indicateurs et format de relevé

Une ligne par demande dans `mesures/demandes.csv` :

```
id, date, telephone, langue, locuteur, split, condition, mode(fichier|micro),
duree_audio_ms, t_fin_parole, t_asr_fin, t_nlu_fin, t_action,
chargement_froid(0|1), ram_pic_mo, transcription, reference, cer,
intention_attendue, intention_predite, confiance,
parametres_attendus, parametres_predits,
action_executee, resultat(succes|echec|non_compris|mauvaise_action)
```

| Famille | Indicateur | Seuil de décision (G1) | Nature |
|---|---|---|---|
| **RAM** | Pic de mémoire SUTA (PSS) ; RAM disponible restante ; processus tués | ≤ 800 Mo ; aucun arrêt du modèle en usage normal | Décision |
| **Taille** | APK ; modèles ; total installé | ≤ 1,5 Go pour 3 langues (projection) | Décision |
| **Latence** | Chargement à froid ; facteur temps réel ; fin de parole → action p50/p90 | Temps réel ≤ 0,5 ; p90 ≤ 2 s à chaud ; chargement à froid noté | Décision |
| **Batterie** | % consommé pendant 60 demandes / 30 min ; % par heure au repos ; température max | Projection ≤ 3 %/jour en usage normal ; pas de bridage thermique | Décision |
| **Erreurs** | CER par langue ; exactitude d'intention ; exactitude des paramètres ; **réussite de bout en bout** ; **taux de mauvaises actions** ; taux de « non compris » | **Aucun seuil de passage** cette semaine (pas de fine-tuning) : ce sont les valeurs de départ. **Exception** : mauvaises actions ≤ 5 %, sinon le seuil de confiance est remonté avant toute autre chose | Valeur de départ |

Avec 6 locuteurs, les taux d'erreur ont une **marge d'incertitude large**.
Le rapport la donne (intervalle de confiance) au lieu d'un chiffre sec.

## 5. Décision de fin de semaine

| Résultat | Condition | Conséquence |
|---|---|---|
| **GO embarqué** | H1 et H2 tiennent sur le téléphone d'entrée | Omnilingual 300M devient l'ASR embarqué de référence ; P1 (E1 fine-tuning) démarre |
| **GO conditionnel** | Tient sur le téléphone témoin mais pas sur l'entrée, ou tient avec un chargement à froid trop long | Lancer E3 (allègement) en priorité ; garder le modèle chaud au premier plan ; nouvelle mesure en semaine 3 |
| **REPLI** | H1 ou H2 tombe sur les deux téléphones | Omnilingual reste **serveur et référence** ; branche § 6.3 du cadrage : petit ASR local choisi parmi les candidats déjà audités, sur mesure |
| **H3** | Par opérateur : fonctionne / ne fonctionne pas | Intention 13 conservée pour les opérateurs validés ; sinon « ouvrir l'appli / composer le code » |
| **H4** | Lignes du tableau § 2.1 confirmées ou non | Nourrit le dossier de **préinstallation système** à présenter à l'ANSUT et au fabricant |

Dans tous les cas, la semaine produit trois acquis réutilisables : le banc de
mesure sur téléphone, un premier jeu de test issu de vrais locuteurs, et les
valeurs de départ des erreurs.

## 6. Risques de la semaine

| Risque | Parade |
|---|---|
| Téléphone PASS pas disponible lundi | Démarrer sur l'équivalent 4 Go ; refaire M1 à M4 sur le vrai terminal dès réception (1 jour) |
| Export ONNX bloquant | Limite J3 midi, puis mode relais (§ 3, J2) ; la semaine n'est pas perdue |
| Locuteurs de langue locale indisponibles | Commencer par la langue locale disponible ; ne **jamais** combler par traduction |
| Transcription de référence incertaine en langue locale | Le CER devient indicatif ; la réussite de bout en bout reste l'indicateur principal |
| Mesure batterie faussée par la charge USB | `adb` en Wi-Fi, téléphone débranché |
