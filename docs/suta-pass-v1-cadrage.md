# SUTA PASS V1 — cadrage technique

> **PASS donne accès au smartphone. SUTA permet de l'utiliser par la voix,
> dans sa langue, même lorsque la connexion est faible ou absente.**

Version 1.1 — 16/09/2026. **Validé comme base de travail SUTA PASS V1.** Ce
document remplace la chaîne « voix → traduction → action ». Il fixe
l'architecture de référence de SUTA sur le smartphone PASS. JULABA devient
une compétence parmi d'autres. RunPod sert de laboratoire.
**Le téléphone est la cible.**

Conventions : **[FAIT]** = établi (audit, fiches PASS, documentation
Android) ; **[HYP]** = hypothèse à mesurer sur le téléphone avant de s'engager ;
**[MESURÉ]** = hypothèse vérifiée sur le téléphone cible, avec référence du
rapport de mesure.

> **Règle : aucune hypothèse sur l'embarqué ne devient une décision tant
> qu'elle n'a pas été mesurée sur le téléphone cible.**

Quatre hypothèses structurantes restent explicitement ouvertes jusqu'au test
matériel (plan : `suta-pass-semaine-1.md`) :

| Réf. | Hypothèse | Si elle tombe |
|---|---|---|
| **H1** | Omnilingual 300M quantifié tient en mémoire et en latence sur le 4 Go | Omnilingual reste serveur et référence ; un petit ASR local prend le relais (§ 6.3) |
| **H2** | L'export ONNX / sherpa-onnx du 300M fonctionne sans perte notable | Même repli que H1, ou autre moteur d'exécution |
| **H3** | Le solde opérateur par USSD fonctionne, par opérateur et sur ce téléphone | L'intention n° 13 devient « ouvrir l'appli ou composer le code opérateur » |
| **H4** | Les fonctions Android sensibles sont accessibles à SUTA (§ 2.1) | Dépend de la préinstallation système ; sinon, version dégradée documentée |

---

## 1. Principes non négociables

1. **Local d'abord.** Une fonction essentielle du téléphone ne dépend jamais
   d'Internet : ni la reconnaissance, ni la compréhension, ni l'action, ni la
   réponse.
2. **On comprend une intention, on ne traduit pas une phrase.** Aucune
   traduction obligatoire dans le noyau. NLLB, MADLAD et les LLM restent des
   outils côté serveur, activés compétence par compétence après benchmark.
3. **Corpus ivoirien produit par des locuteurs, jamais traduit.** C'est la
   leçon principale d'Injongo.
4. **Une action risquée se confirme.** Un appel, un envoi, une dépense ou une
   urgence passe toujours par une confirmation. Aucun code PIN ni mot de
   passe n'est jamais dit à voix haute.
5. **La voix ne remplace pas l'écran, elle l'accompagne.** Chaque réponse a
   un équivalent visuel (icône, photo du contact, gros bouton).
6. **Mesurer sur un vrai téléphone PASS.** Un chiffre obtenu sur un GPU
   RunPod ne valide rien côté produit.

## 2. Contrainte matérielle de référence

D'après `supabase/fiches/pass-public.json`, **[FAIT]** les deux modèles
partagent **4 Go de RAM, 64 Go de stockage, une batterie de 5 000 mAh et la
4G**. Le modèle à 14 900 F ajoute le NFC, un lecteur d'empreintes et un
meilleur processeur.

On vise donc le **modèle d'entrée (9 900 F)**. Ce qui tourne dessus tourne
partout.

| Ressource | Budget SUTA V1 | Commentaire |
|---|---|---|
| RAM au pic (ASR chargé) | ≤ 800 Mo | Android et les applications résidentes occupent déjà 2 à 2,5 Go **[HYP]** |
| Stockage | ≤ 1,5 Go pour 3 langues | Suffisant sur 64 Go. Préinstallation possible |
| Latence fin de parole → début d'action | p50 ≤ 1,2 s, p90 ≤ 2 s | Mode offline **[HYP]** |
| Batterie | ≤ 3 % par jour en usage normal | Pas d'écoute permanente en V1 |

**Levier majeur, à confirmer avec l'ANSUT et le fabricant :** si SUTA est
**préinstallée dans l'image système PASS** (application privilégiée, rôle
d'assistant par défaut) :

- plus de restrictions du Play Store sur `CALL_PHONE`, `READ_SMS`,
  `SEND_SMS` et l'accessibilité ;
- les appels d'urgence passent directement (`ACTION_CALL_PRIVILEGED`) ;
- un bouton physique peut être dédié à SUTA ;
- les modèles sont déjà sur le téléphone, sans téléchargement.

C'est la décision **industrielle** la plus structurante de la V1.

### 2.1 Offline ≠ autorisé (hypothèse H4)

« Offline » répond à la question *faut-il Internet ?*. Une autre question
est indépendante : *Android laisse-t-il SUTA le faire ?*. Plusieurs
intentions offline dépendent surtout de ce second point :

| Niveau de droit | Intentions concernées | Application installée hors Play Store | Application préinstallée système |
|---|---|---|---|
| **Libre** (aucune autorisation ou autorisation simple) | OUVRIR_APP, VOLUME (hors silencieux), LAMPE, INFO_TELEPHONE, ALARME, AIDE, PHOTO | Oui | Oui |
| **Autorisation sensible** accordée par l'utilisateur | APPELER (`CALL_PHONE`), LIRE_MESSAGES (`READ_CALL_LOG`, `READ_SMS`), MESSAGE_VOCAL par SMS (`SEND_SMS`), VOLUME silencieux | Oui, après un écran d'autorisation ; **refusé sur le Play Store** pour SMS et journal d'appels | Oui, accordé d'office |
| **Service activé à la main** | NAVIGUER (accessibilité), lecture des notifications | Oui, mais l'activation est difficile pour un public peu alphabétisé | Pré-activé |
| **Privilège système** | URGENCE en appel direct (`ACTION_CALL_PRIVILEGED`), rôle d'assistant par défaut, bouton physique | **Non** (l'appel d'urgence passe par le composeur, avec un toucher) | Oui |

Ce tableau est **[HYP]** tant qu'il n'a pas été vérifié sur le téléphone PASS
et sa version d'Android (surcouche du fabricant comprise).

## 3. Architecture cible

```
                    ┌──────────────────── TÉLÉPHONE PASS (offline) ─────────────────────┐
 Appui bouton ──▶  VAD ──▶ ASR embarqué ──▶ Normalisation ──▶ Moteur ──▶ Politique ──▶ Action Android
 (push-to-talk)   (Silero)  candidat H1 :     (orthographe,    d'intentions  de dialogue   (Contacts, Audio,
                            Omni 300M INT8    nombres,         + slots       (confirmer,   Caméra, USSD,
                            + biais contacts  lexiques)        (local)       relancer)     Accessibilité…)
                                                                                 │
                    Mots de dialogue (oui / non / répète / stop) : repérage de   ▼
                    mots-clés dédié, indépendant de l'ASR complet            Réponse
                                                                             audio enregistrée (langues ivoiriennes)
                                                                             TTS système (français)
                                                                             + écran
                    └────────────────────────────────────────────────────────────────────┘
                                          │ uniquement si : intention ONLINE,
                                          │ ou confiance faible ET réseau OK ET consentement
                                          ▼
                    ┌──────────────────────── SERVEUR SUTA (online) ─────────────────────┐
                    Passerelle ──▶ Omnilingual grand modèle (réécoute) ──▶ NLU serveur (enseignant)
                        │                                                      │
                        ├──▶ Compétences : SERVICE_PASS (base SUTA existante), JULABA,
                        │    Opérateurs, Paiement, Traduction (NLLB/MADLAD, sous garde-fou qualité),
                        │    Assistance ouverte (LLM)
                        └──▶ Distribution : codes USSD, points PASS, FAQ audio, alias d'applis,
                             mises à jour des modèles
                    └────────────────────────────────────────────────────────────────────┘
                    RunPod = laboratoire : fine-tuning, benchmarks, distillation. Jamais en production.
```

Contrat unique entre les couches, identique côté téléphone et côté serveur :

```json
{
  "lang": "dyu",
  "transcript": "…",
  "intent": "APPELER",
  "slots": { "contact": { "value": "contact:412", "raw": "…", "score": 0.91 }, "sim": null },
  "confidence": 0.88,
  "source": "device",
  "mode": "OFFLINE",
  "needs_confirmation": true
}
```

## 4. Catalogue V1 : 15 intentions et leurs paramètres

La V1 livre **12 intentions offline, 1 hybride réseau GSM sans données et 2
online**. Trois compétences online sont **routées mais pas exécutées** en V1.
S'y ajoutent **4 intentions de dialogue** transverses.

Les exemples sont donnés en français. **Aucun exemple en dioula, baoulé ou
autre langue n'est écrit dans ce document** : ils viendront de la collecte
auprès des locuteurs (§ 8). Les écrire à leur place répéterait l'erreur des
corpus traduits.

Politique de confirmation :

- **A** = exécution directe (action réversible) ;
- **B** = annonce + annulation possible pendant 3 s ;
- **C** = confirmation explicite obligatoire.

### 4.1 Offline : fonctions essentielles

| # | Intention | Exemple (FR) | Paramètres | Action Android | Conf. |
|---|---|---|---|---|---|
| 1 | `APPELER` | « Appelle maman » | `contact` (répertoire, obligatoire sauf si `numero`) ; `numero` (chiffres) ; `sim` (1/2, optionnel) | `ContactsContract` + `ACTION_CALL` ; choix de la SIM via `TelecomManager` | B |
| 2 | `OUVRIR_APP` | « Ouvre WhatsApp » | `application` (applis installées + alias locaux) | `PackageManager.getLaunchIntentForPackage` (déclarer `<queries>`) | A |
| 3 | `VOLUME` | « Monte le son » | `sens` (monter/baisser/couper/max) ; `cible` (sonnerie/média/appel, défaut : contexte) ; `niveau` (optionnel) | `AudioManager.adjustStreamVolume` ; mode silencieux via `ACCESS_NOTIFICATION_POLICY` | A |
| 4 | `PHOTO` | « Prends-moi en photo » | `camera` (arrière/avant) ; `type` (photo/vidéo) ; `retardateur` (s, défaut 3) | Capture **dans SUTA** (CameraX) avec décompte vocal, puis galerie | A |
| 5 | `LAMPE` | « Allume la torche » | `etat` (allumer/éteindre) | `CameraManager.setTorchMode` | A |
| 6 | `INFO_TELEPHONE` | « Il reste combien de batterie ? » | `sujet` (heure/date/batterie/réseau/stockage) | `BatteryManager`, horloge, `TelephonyManager`, `ConnectivityManager` | A |
| 7 | `MESSAGE_VOCAL` | « Enregistre un message pour Koffi » | `destinataire` (contact, optionnel) ; `canal` (SMS vocal/WhatsApp/note locale) | `MediaRecorder`, puis partage (1 toucher en V1) | B |
| 8 | `LIRE_MESSAGES` | « Qui m'a appelé ? » / « Lis mes messages » | `source` (appels manqués/SMS/notifications) ; `nombre` (défaut 3) ; `contact` (optionnel) | `CallLog`, `READ_SMS`, `NotificationListenerService` ; lecture en TTS français | A |
| 9 | `NAVIGUER` | « Retour » / « Écran d'accueil » | `geste` (retour/accueil/récents/notifications/défiler haut-bas) | `AccessibilityService.performGlobalAction` + défilement par nœuds | A |
| 10 | `ALARME` | « Réveille-moi à 5 h » | `heure` (grammaire horaire par langue) ; `jour` (optionnel) ; `libelle` (optionnel) | `AlarmClock.ACTION_SET_ALARM` | B |
| 11 | `AIDE` | « Qu'est-ce que tu sais faire ? » | `sujet` (optionnel : une intention, une appli) | Tutoriels audio + animations locales | A |
| 12 | `URGENCE` | « Appelle les pompiers » | `service` (police/pompiers/SAMU/contact de confiance) ; `partager_position` (oui/non) | Appel du numéro d'urgence. Hors application privilégiée, Android impose `ACTION_DIAL`. SMS de position via GPS, qui fonctionne sans données | C, rapide : un seul « oui » |

Les numéros d'urgence ivoiriens (police, pompiers, SAMU) sont à valider
officiellement avant d'être embarqués. Ils ne doivent pas être codés en dur :
ils arrivent avec la configuration.

### 4.2 Hybride : réseau GSM, sans Internet

| # | Intention | Exemple | Paramètres | Action | Conf. |
|---|---|---|---|---|---|
| 13 | `SOLDE_OPERATEUR` | « Combien il me reste de crédit ? » | `type` (crédit/internet) ; `sim` (1/2) ; `operateur` (déduit de la SIM) | `TelephonyManager.sendUssdRequest`, un seul échange ; réponse lue en TTS français avec des chiffres affichés | A |

**[HYP] H3.** L'USSD ne consomme pas de données mobiles, mais
`sendUssdRequest` dépend de l'opérateur, du format de sa réponse, du
téléphone et de la SIM utilisée en double SIM. L'intention n'est **pas
garantie** tant qu'elle n'a pas été testée pour Orange, MTN et Moov sur le
terminal PASS. Les codes par opérateur sont une configuration distribuée par
le serveur, jamais du code. Les menus USSD à
plusieurs étapes, dont le mobile money, sont **hors V1**.

### 4.3 Online : services

| # | Intention | Exemple | Paramètres | Serveur | Repli sans Internet |
|---|---|---|---|---|---|
| 14 | `SERVICE_PASS` | « Mon téléphone ne charge plus, je fais comment ? » | `sujet` (garantie/panne/point PASS/programme/recours) ; `localite` (optionnel) ; `reference_dossier` (si authentifié) | Base de connaissances SUTA existante (fiches PASS) + API PASS à définir | FAQ audio en cache, et **appel du centre PASS** (voix, sans données) |
| 15 | `TRADUIRE` | « Qu'est-ce que dit ce message ? » | `texte_source` (dernier SMS/notification/phrase dite) ; `langue_cible` (langue de l'utilisateur) | NLLB/MADLAD, **seulement pour les paires qui passent le seuil qualité** ; sinon message clair | « Je ne peux pas traduire sans réseau. Je peux le lire en français. » |

**Routées mais non exécutées en V1** (l'intention est reconnue, puis on
oriente l'utilisateur) : `JULABA` (sous-intentions définies par l'équipe
JULABA), `PAIEMENT` (montant, bénéficiaire, portefeuille : exécution
interdite tant que l'analyse de sécurité voix et PIN n'est pas faite) et
`ASSISTANCE` (question ouverte vers un LLM).

### 4.4 Dialogue, sur toutes les intentions

`OUI`, `NON_ANNULER`, `REPETER`, `STOP`. Ce vocabulaire fermé est traité par
un **repérage de mots-clés dédié**, très léger, entraîné par langue et
français inclus. Ces mots doivent marcher même quand l'ASR complet se trompe.

Le **mélange de langues** est la norme : « ouvre Orange Money » dit au milieu
d'une phrase en dioula, des nombres en français. Il fait partie du corpus
dès le départ et n'est pas traité comme une exception.

## 5. Ce qui tourne réellement offline sur Android

| Brique | Solution V1 | Taille indicative | Statut |
|---|---|---|---|
| Détection de voix | Silero VAD (ONNX) | ~2 Mo | [FAIT] utilisé couramment sur mobile |
| ASR | **Candidat :** Omnilingual **300M CTC**, quantifié INT8, via **sherpa-onnx** ou ONNX Runtime Mobile. **Repli :** petit ASR local (§ 6.3) | ~350 Mo disque, 500–700 Mo RAM (estimations, non mesurées) | **[HYP] H1 + H2**, décision à la fin de la semaine 1 |
| Mots de dialogue | Repérage de mots-clés (sherpa-onnx KWS ou petit modèle dédié) | < 10 Mo | [HYP] |
| Moteur d'intentions | Classifieur n-grammes de caractères + grammaires de paramètres ; puis petit encodeur distillé | 1–5 Mo, puis ≤ 100 Mo | [HYP] voir § 7 |
| Paramètres « fermés » | Répertoire, applis installées, gestes : correspondance approximative sur formes normalisées | — | [FAIT] faisable |
| Actions | API Android natives (§ 4) | — | [FAIT] |
| Réponse, langues ivoiriennes | **Audio humain enregistré** + concaténation (nombres, heures, pourcentages) | 20–40 Mo par langue | [FAIT] faisable |
| Réponse, français | TTS système Android (voix hors ligne) ou Piper | 0–60 Mo | [FAIT] |
| Stockage des demandes en attente | Base locale chiffrée + WorkManager | — | [FAIT] |

**Ce qui ne tourne pas offline en V1 :** traduction, LLM, grand modèle ASR,
paiement, services PASS dynamiques (dossier, stock des points), JULABA.

**Gestion mémoire :** le modèle ASR est chargé quand on appuie sur le bouton,
gardé chaud tant que l'écran est allumé, puis libéré sur `onTrimMemory`.
Temps de chargement à froid à mesurer **[HYP]** : s'il dépasse 1,5 s, on
garde un service au premier plan.

**Déclenchement :** pas de mot d'éveil permanent en V1 (batterie, vie privée,
faux déclenchements). On prévoit une **bulle flottante**, un **appui long
sur un bouton physique** si le fabricant le permet, et un raccourci
d'accessibilité.

## 6. Omnilingual : aujourd'hui et demain

### 6.1 Sa place exacte aujourd'hui

Omnilingual est **l'oreille de SUTA**. Il a quatre rôles actuels :

1. **Référence de benchmark (RunPod)** : taux d'erreur par caractère (CER)
   et par mot par langue ivoirienne, sur **notre** jeu de test de commandes
   enregistrées sur téléphone, pas sur des corpus de lecture.
2. **Amorçage du corpus (RunPod)** : il pré-transcrit les enregistrements
   de collecte, puis des humains corrigent. La collecte coûte ainsi moins cher.
3. **ASR serveur du mode online** : le grand modèle (CTC 1B/3B ou variante
   LLM) réécoute une demande quand le téléphone est peu sûr de lui et que le
   réseau le permet. La variante zero-shot, qui accepte quelques exemples,
   est à évaluer pour les langues mal couvertes.
4. **Candidat embarqué, pas encore décision** : le 300M CTC, testé tel quel
   sur le téléphone dès la semaine 1 (H1, H2).

Ce qu'il n'est **pas** : une dépendance réseau des fonctions essentielles.

### 6.2 Stratégie d'ASR embarqué, par étapes et avec critères de passage

| Étape | Contenu | Critère de passage |
|---|---|---|
| **E0 — tel quel** | 300M CTC INT8 sur le téléphone d'entrée, sans adaptation | Facteur temps réel ≤ 0,5 ; RAM pic ≤ 800 Mo ; CER mesuré par langue (valeur de départ) |
| **E1 — spécialisation** | Fine-tuning du 300M sur le corpus de commandes ivoirien (§ 8) + parole spontanée. Pour le **dioula**, transfert depuis AfVoices et les corpus bambara (même continuum mandingue) | Réussite des tâches de bout en bout +15 points par rapport à E0 |
| **E2 — biais contextuel** | Les noms du répertoire et les applis installées pèsent sur le décodage (hotwords ou score CTC direct des candidats) | Paramètre `contact` juste ≥ 90 % sur un répertoire de 150 noms |
| **E3 — allègement** | Distillation ou élagage vers ~100M si le modèle d'entrée n'atteint pas E0 | Mêmes critères que E0 |
| **E4 — piste recherche** | Parole → intention directe : une tête de classification sur l'encodeur Omnilingual, sans passer par le texte, pour les intentions fermées | À comparer avec ASR + NLU ; adoptée seulement si elle fait mieux |

On garde **un seul modèle ASR multilingue ivoirien** en mémoire, pas un
modèle par langue. La langue de l'utilisateur est choisie à la prise en main
et sert au moteur d'intentions, pas à l'ASR CTC.

### 6.3 Branche de repli si H1 ou H2 tombe

L'architecture ne change pas : voix → ASR → intention + paramètres → action
→ réponse. Seule la brique ASR embarquée change :

- **Omnilingual reste l'oreille serveur et la référence** : benchmark,
  pré-transcription du corpus, réécoute online, enseignant.
- **Un petit ASR local prend le relais sur le téléphone**, par exemple à
  vocabulaire limité aux commandes V1, et entraîné ou distillé à partir du
  corpus pré-transcrit par Omnilingual.
- Le choix de ce petit ASR se fait **parmi les candidats déjà audités**, sur
  mesure au téléphone. Pas de nouvel inventaire.
- Les étapes E1 à E4 restent valables : elles s'appliquent au modèle retenu.

## 7. Moteur d'intentions « à la Injongo », corpus ivoirien

### 7.1 Ce qu'on reprend d'Injongo

- Intentions + paramètres plutôt que traduction générale.
- Énoncés **produits par des locuteurs à partir de scénarios**, pas traduits
  depuis l'anglais ou le français.
- Des encodeurs multilingues fine-tunés sur ces données, qui battent la
  traduction puis la classification.

### 7.2 Ce qu'on change

- **Entrée = sortie de l'ASR**, pas du texte propre. Le classifieur est
  entraîné **sur les transcriptions Omnilingual réelles** (avec leurs
  fautes) autant que sur les transcriptions corrigées. Le moteur apprend
  ainsi l'orthographe de l'ASR, ce qui compte beaucoup pour des langues sans
  orthographe stabilisée.
- **Domaine = usage du téléphone PASS**, et non banque ou voyage.
- **Cible = modèle embarqué minuscule**, avec un modèle serveur plus gros
  comme enseignant.

### 7.3 Pipeline

1. **Normalisation** par langue : casse, variantes orthographiques, mots de
   nombres → chiffres, lexique des parentés (« maman », « tonton », « grand
   frère ») relié aux intitulés du répertoire.
2. **Classification** : V1 = n-grammes de caractères (type fastText, de
   l'ordre de la milliseconde, quelques Mo), robuste au bruit orthographique.
   V1.5 = petit encodeur multilingue africain distillé, exporté en ONNX INT8,
   **gardé seulement s'il bat le premier sur le téléphone**.
3. **Paramètres** :
   - listes fermées (contacts, applis, gestes) par correspondance
     approximative sur les listes du téléphone ;
   - valeurs ouvertes (heure, nombre, montant) par grammaires par langue ;
   - repli à l'étape E2 : scorer les candidats directement sur la sortie CTC.
4. **Politique de dialogue** : confiance haute → politique A/B/C du § 4 ;
   confiance moyenne → confirmation (« J'appelle Awa ? ») ; confiance basse →
   si online, réécoute serveur (budget 2,5 s), sinon 3 choix affichés avec
   icônes ; deux échecs → mode tactile guidé.
5. **Serveur** : un grand encodeur ou un LLM avec exemples sert d'enseignant,
   annote les cas difficiles remontés (avec consentement) et alimente la
   distillation.

### 7.4 Corpus SUTA-CI : protocole

- **Schéma** : les 15 intentions, leurs paramètres et leurs types sont
  définis en français. C'est la seule chose rédigée en français.
- **Élicitation par scénario** : image ou situation (« votre fille est à
  Bouaké, vous voulez l'appeler »), puis « dites-le comme vous le diriez à
  votre téléphone ». Plusieurs formulations par scénario.
- **Enregistré en audio, sur le téléphone PASS**, dans de vrais
  environnements : cour, marché, transport, intérieur.
- **Locuteurs** : 40 par langue de départ, équilibrés en âge, genre, région
  et **niveau d'alphabétisation**, avec consentement écrit ou enregistré et
  rémunération. Cible **[HYP]** : ~100 énoncés par locuteur, soit ~4 000 par
  langue.
- **Annotation** : transcription de référence + sortie ASR conservée +
  intention + paramètres + marquage des mélanges de langues.
- **Découpage par locuteur** : aucun locuteur à la fois en entraînement et en
  test. Un sous-ensemble de test est tenu secret.
- **Outil** : une **application de collecte Android**, premier logiciel
  construit, qui teste aussi le micro et le matériel.
- **Propriété et gouvernance** : données détenues par l'ANSUT, conformes à la
  loi ivoirienne sur les données personnelles (ARTCI). La transcription
  écrite de chaque langue est validée avec des linguistes.

**Cible produit V1 :** français ivoirien, dioula et baoulé.

**La collecte cible ne bloque pas le prototype.** 40 locuteurs × 3 langues
est l'objectif de la base de référence. Les essais techniques démarrent avec
**le français + une seule langue locale** et une poignée de locuteurs. La
seconde langue locale s'ajoute dès que la chaîne complète est stable sur le
téléphone. La seule exigence non négociable dès le premier énoncé : **il est
produit par un vrai locuteur, jamais traduit**. Les suivantes (bété, sénoufo, attié, etc.) seront
ajoutées selon la carte du déploiement PASS, en appliquant le même
protocole.

## 8. Stratégie TTS par langue

Le baoulé et le dioula sont des **langues à tons**. Une synthèse qui se
trompe de ton peut changer le sens ou devenir incompréhensible. D'où cette
stratégie en paliers :

| Palier | Français | Dioula, baoulé, autres |
|---|---|---|
| **V1** | TTS système Android hors ligne (aucun coût) | **Voix humaine enregistrée** : catalogue de 200 à 300 messages par langue (confirmations, erreurs, aide, tutoriels) + segments concaténables (nombres 0–100, heures, pourcentages, jours) |
| **V1, contenu dynamique** | TTS | Nom de contact : on joue le nom en TTS français **et** on affiche sa photo et son nom. Contenu libre (SMS) : lu en français, ou traduit online si la paire est validée |
| **V2** | Voix française à accent ivoirien (Piper/VITS fine-tuné) | **Voix synthétique propre par langue** : 5 à 10 h de studio avec **le même comédien** que les messages V1, modèle VITS/Piper (runtime sous licence libre, embarquable) |
| **Critère d'adoption V2** | — | Test d'écoute auprès de locuteurs : compréhension ≥ 95 % et préférence non inférieure à la voix enregistrée |

MMS-TTS de Meta peut servir de **comparaison en laboratoire seulement**. Sa
licence non commerciale (CC-BY-NC) interdit de l'utiliser dans le produit
sans accord. Sa couverture des langues ivoiriennes est à vérifier.

## 9. Quand Internet disparaît, puis revient

### 9.1 États de connectivité

Le « réseau présent » annoncé par Android ne suffit pas. L'état est déduit
d'une **sonde réelle** vers la passerelle SUTA.

| État | Définition | Comportement |
|---|---|---|
| `EN_LIGNE` | Sonde < 800 ms | Intentions online possibles ; réécoute serveur si confiance basse |
| `DEGRADE` | Sonde lente ou 2G/EDGE | Tout en local ; online seulement pour les intentions qui n'existent qu'en ligne, avec phrase d'attente et délai de 8 s |
| `HORS_LIGNE` | Échec de la sonde | Tout en local ; les intentions online passent au repli (§ 4.3) |

### 9.2 Pendant la coupure

- Les **12 intentions offline + l'USSD** fonctionnent à l'identique.
  L'utilisateur ne doit pas sentir de différence.
- Pour une intention online, SUTA **le dit dans la langue de l'utilisateur**
  avec un message enregistré, puis propose **l'alternative sans données**
  (appeler le centre PASS, consulter la FAQ en cache).
- **Mise en attente** d'une demande seulement si elle est **informative et
  sans risque** (« où est le point PASS le plus proche »). Elle est gardée
  dans une file locale chiffrée, avec une clé d'idempotence et une **durée
  de vie** (24 h par défaut).
- **Jamais mis en attente :** paiement, transfert, achat de forfait,
  urgence. Ces demandes sont refaites **et reconfirmées** au retour du
  réseau.
- Si le réseau coupe **pendant** une requête : délai dépassé → résultat
  local s'il existe, sinon message de repli. Pas de silence.

### 9.3 Au retour du réseau (WorkManager, dans cet ordre)

1. Vider la file des demandes encore valides. Le résultat est annoncé par
   **une notification discrète**, puis dit à voix haute seulement si
   l'utilisateur ouvre SUTA.
2. Récupérer la **configuration légère** : codes USSD, points PASS, FAQ
   audio, alias d'applications, numéros officiels.
3. Envoyer la **télémétrie consentie** : échecs, confiances basses, audio
   seulement si consentement explicite, **en Wi-Fi uniquement** par défaut.
4. **Mises à jour de modèles** : Wi-Fi uniquement ou au point PASS, par
   paquets différentiels, avec retour arrière si le taux d'échec augmente.

Principe de coût : SUTA ne consomme **jamais** le forfait data de
l'utilisateur pour son propre entretien sans son accord.

## 10. Plan de prototype de bout en bout sur téléphone réel

**Prérequis semaine 0 :** obtenir **le téléphone PASS d'entrée**. À défaut,
un Android équivalent (4 Go de RAM, même famille de processeur, à demander
au fabricant) + 2 téléphones d'autres gammes pour encadrer les mesures.

| Phase | Semaines | Livrable sur le téléphone | Travail RunPod | Critère de passage |
|---|---|---|---|---|
| **P0 — semaine 1** | 1 | Mesures brutes sur le téléphone 4 Go / 64 Go : RAM, taille, latence, batterie, erreurs sur 5 intentions ; tests H1 à H4 | Export et quantification du 300M | Rapport de mesure + décision go / go conditionnel / repli (voir `suta-pass-semaine-1.md`) |
| **P1 — oreille embarquée** | 2–3 | Appli Kotlin : bouton → VAD → Omnilingual 300M INT8 → transcription affichée + banc de mesure (latence, RAM, batterie, température) | Benchmark serveur du même jeu de test (valeur de référence) | **G1 :** facteur temps réel ≤ 0,5 ; RAM ≤ 800 Mo ; CER mesuré en fr, dyu et bci sur 100 énoncés chacun |
| **P1 bis — collecte** | 1–6 | Appli de collecte déployée auprès des locuteurs, **français + 1 langue locale d'abord** | Pré-transcription automatique | 1 000 énoncés annotés pour la première langue locale ; la seconde démarre quand la chaîne est stable |
| **P2 — boucle offline** | 3–6 | 8 intentions (APPELER, OUVRIR_APP, VOLUME, PHOTO, LAMPE, INFO_TELEPHONE, NAVIGUER, AIDE) + dialogue + audio enregistré, **mode avion activé** | Entraînement du classifieur sur sortie ASR réelle | **G2 :** réussite des tâches ≥ 80 % au calme, ≥ 65 % en bruit ; **mauvaises actions ≤ 2 %** ; p90 ≤ 2 s |
| **P3 — hybride** | 6–9 | Les 15 intentions ; passerelle serveur ; SERVICE_PASS branché sur la base SUTA ; file d'attente et reconnexion ; USSD | Grand ASR + NLU enseignant exposés comme API de test | **G3 :** 12 scénarios de coupure et retour réussis (§ 9), dont coupure pendant une requête |
| **P4 — spécialisation et terrain** | 9–12 | Modèle E1 + E2 embarqué ; test avec **30 vrais utilisateurs** sur 2 sites (quartier précaire d'Abidjan + village), séances observées | Fine-tuning du 300M, export, quantification | **G4 (décision V1) :** réussite ≥ 85 % en conditions réelles ; au moins 70 % des utilisateurs peu alphabétisés réussissent 5 tâches sans aide |

**Indicateurs suivis à chaque phase :** exactitude d'intention, F1 des
paramètres, **réussite de bout en bout**, taux de mauvaises actions,
latence p50/p90, RAM au pic, batterie par heure d'usage, taille installée.

Le taux de **mauvaises actions** (appeler la mauvaise personne) compte plus
que l'exactitude brute : un « je n'ai pas compris » vaut mieux qu'une erreur
exécutée.

## 11. Risques principaux

| Risque | Parade |
|---|---|
| Le 300M est trop lourd pour le modèle d'entrée | E3 (distillation) ; repli sur le repérage de mots-clés pour les 8 intentions critiques |
| La transcription des noms propres est mauvaise | E2 (biais répertoire) + photo et confirmation B |
| Orthographe instable des langues | Classifieur entraîné sur la sortie ASR, pas sur une orthographe « idéale » |
| Restrictions Android pour une appli non système | Préinstallation PASS (§ 2) ; sinon version Play Store dégradée et documentée |
| Traduction de mauvaise qualité | Hors du noyau ; activée seulement par paire validée |
| Données vocales sensibles | Local par défaut, consentement explicite, hébergement de production en Côte d'Ivoire, conformité ARTCI |

## 12. Décisions attendues

1. **Préinstallation dans l'image PASS** et accès au fabricant (processeur,
   bouton physique, application privilégiée) ?
2. **Langues V1** : français, dioula et baoulé confirmés ?
3. **API PASS** : existe-t-elle ou faut-il en écrire le contrat (statut de
   dossier, points PASS, garantie) ?
4. **Hébergement de production** du serveur SUTA (souverain) ?
5. **Budget de collecte** : ~120 locuteurs rémunérés à terme pour 3 langues,
   sans bloquer le prototype.
6. **Première langue locale des essais** : dioula ou baoulé, selon les
   locuteurs mobilisables immédiatement.
