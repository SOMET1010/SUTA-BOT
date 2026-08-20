# Script de démonstration Salon

Cahier des charges, section 50. Démonstration cible de 3 à 5 minutes.

## État actuel (à lire avant toute démo)

Ce document décrit l'expérience **cible**, une fois le Lot 3 (connexion
Realtime Azure/OpenAI réelle) branché. À ce stade du projet :

| Élément                                             | Disponible aujourd'hui ?                                    |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Recherche documentaire réelle (`search_knowledge`)   | ✅ Oui — via le canal texte                                   |
| Réponse construite uniquement à partir de la base    | ✅ Oui                                                         |
| Affichage des sources                                | ✅ Oui                                                         |
| Réponse « je ne sais pas » si hors base              | ✅ Oui                                                         |
| Voix (parler à SUTA, entendre sa réponse)            | ❌ Non — nécessite le Lot 3                                    |
| Question contextuelle (« et le deuxième ? »)         | ❌ Non — nécessite un modèle conversationnel (Lot 3)           |
| Interruption pendant que SUTA parle                  | ❌ Non — nécessite une session Realtime live (Lot 3)           |

Tant que le Lot 3 n'est pas branché, faire la démonstration au **clavier**
(champ texte), qui utilise le vrai pipeline RAG. Les étapes 4 et 5
ci-dessous sont marquées « **cible, nécessite Lot 3** ».

⚠️ Le corpus utilisé (`data/demo/`) est **fictif**, créé pour valider le
pipeline technique. Avant toute démonstration devant un public réel,
remplacer ce corpus par des documents validés par l'ANSUT
(`npm run knowledge:ingest` après avoir remplacé le contenu de
`data/demo/`).

## Déroulé (1 → 8, cahier des charges section 50)

### 1. Présentation SUTA

Ouvrir l'écran d'accueil (`?mode=kiosk` en conditions réelles). Montrer le
nom SUTA, l'avatar, la question « Comment puis-je vous aider ? ».

> « Voici SUTA, l'assistant conversationnel d'ANSUT CONNECTE. »

### 2. Question institutionnelle

Taper : **« Bonjour SUTA, qui es-tu ? »**

SUTA répond avec sa phrase d'identité (réponse scriptée, section 4
Démonstration 1) : présentation de son rôle, invite à poser une question.

### 3. Recherche dans la connaissance ANSUT

Taper : **« Quels programmes sont disponibles pour les jeunes
entrepreneurs ? »**

L'état passe par « Je réfléchis... » puis « Je recherche l'information...
», puis SUTA répond à partir d'un fragment réellement récupéré dans la
base de connaissances (voir « Voir les sources » sous la réponse).

### 4. Question contextuelle *(cible, nécessite Lot 3)*

Taper : **« Et comment je peux en bénéficier ? »**

Cible : SUTA comprend que « en bénéficier » fait référence au programme
évoqué précédemment (nécessite qu'un modèle conserve le contexte de la
conversation — Lot 3). Aujourd'hui, poser une question autonome et
complète à la place, ex. : « Comment bénéficier de ce programme ? ».

### 5. Interruption naturelle *(cible, nécessite Lot 3)*

Pendant que SUTA parle, l'utilisateur recommence à parler :

> « Attends. Dis-moi seulement les conditions principales. »

Cible : la lecture audio s'arrête immédiatement, SUTA traite la nouvelle
demande (nécessite une session Realtime live — Lot 3). Aujourd'hui, ce
comportement n'est pas démontrable ; passer directement à l'étape
suivante.

### 6. Question complexe

Taper : **« Quelle est la couleur du logo de l'ANSUT ? »** (ou toute
question hors du corpus).

SUTA répond qu'il ne dispose pas de cette information — jamais une
réponse inventée (section 58, critère absolu).

### 7. Affichage des sources

Revenir sur la réponse de l'étape 3, cliquer sur « Voir les sources »
pour montrer que la réponse s'appuie sur des documents identifiés et
consultables (section 38).

### 8. Conclusion

> « SUTA s'appuie uniquement sur les documents officiels de l'ANSUT pour
> répondre. Aujourd'hui la démonstration se fait au clavier ; la voix et
> les conversations en plusieurs échanges arriveront avec la connexion au
> service Azure Realtime. »

## Réinitialisation entre deux visiteurs

Cliquer sur le bouton discret « Réinitialiser » en bas à droite de
l'écran (mode kiosque), ou laisser l'inactivité déclencher le reset
automatique (`KIOSK_IDLE_RESET_MS`, section 23).
