# API SUTA — interface pour applications tierces

> Contrat d'interface des points d'accès publics de SUTA, vérifié sur le
> code en production le 04/10/2026. Toute évolution de ces formats doit
> mettre ce document à jour dans le même commit.

**URL de base (production)** : `https://suta-bot-web.vercel.app`

Généralités :

- Toutes les requêtes sont en `POST` avec `Content-Type: application/json`
  (UTF-8). Les réponses sont en JSON.
- Les données servies sont exclusivement les données PUBLIQUES du corpus
  SUTA (la visibilité est imposée côté serveur, quoi que demande
  l'appelant).
- Pas de clé d'API à ce jour ni de quota : usage mesuré attendu
  (une limitation de débit est au backlog).
- **Appels serveur-à-serveur recommandés.** Les routes n'émettent pas
  d'en-têtes CORS : un navigateur sur un autre domaine sera bloqué —
  faites appeler SUTA par votre backend, pas par le navigateur.
- Délai de réponse : viser un timeout client de 15 s (la recherche
  interroge une fonction distante plafonnée à 9 s, avec un secours).
- Codes d'erreur : `400` entrée invalide, `503` service momentanément
  indisponible — toujours avec un corps `{"error": "<message>"}`.
  Réessayez une fois après quelques secondes sur un `503`.

---

## 1. Rechercher dans la base de connaissances

`POST /api/tools/search-knowledge` — lecture seule.

Entrée :

| Champ | Type | Règles |
|---|---|---|
| `query` | string | requis, 1 à 500 caractères — la question, en français |
| `limit` | entier | optionnel, 1 à 10 — nombre maximal de résultats |

Réponse `200` :

```json
{
  "results": [
    {
      "title": "Localité — ...",
      "content": "extrait de la fiche (texte)",
      "source": "Corpus ANSUT",
      "score": 0.0,
      "location": { "lat": 5.33, "lng": -4.07, "label": "..." }
    }
  ]
}
```

- `location` n'est présent que pour les fiches géolocalisées.
- `results` peut être vide : la question est hors du domaine de SUTA ou
  rien de pertinent n'existe — c'est une réponse normale, pas une erreur.
- Ne pas sur-interpréter `score` : ce champ hérité ne reflète pas l'ordre
  réel de pertinence (l'ordre de la liste, si). Son retrait est au backlog.
- Ces résultats sont des PREUVES (extraits de fiches), pas une réponse
  rédigée : c'est à l'application appelante de formuler. SUTA n'expose
  pas aujourd'hui de point d'accès « question → réponse rédigée ».

Exemple :

```bash
curl -s https://suta-bot-web.vercel.app/api/tools/search-knowledge \
  -H 'Content-Type: application/json' \
  -d '{"query": "les écoles sont-elles connectées à San-Pédro ?", "limit": 4}'
```

---

## 2. Où est-ce que ça capte près d'une localité ?

`POST /api/tools/point-connecte` — lecture seule.

Entrée :

| Champ | Type | Règles |
|---|---|---|
| `localite` | string | requis, 2 à 80 caractères — nom de la localité de départ |

Réponse `200`, localité non reconnue :

```json
{ "ok": true, "trouve": false, "localite": "<nom demandé>" }
```

Réponse `200`, localité reconnue :

```json
{
  "ok": true,
  "trouve": true,
  "localite": { "nom": "...", "departement": "...", "region": "...", "lat": 0, "lng": 0 },
  "couverteSurPlace": false,
  "points": [
    {
      "nom": "...", "departement": "...", "region": "...",
      "distanceKm": 7.4, "lat": 0, "lng": 0,
      "extrait": "description courte du point couvert"
    }
  ]
}
```

- Les distances sont À VOL D'OISEAU — toute restitution à un usager doit
  le préciser.
- La résolution des noms tolère les noms composés (« Songon » trouve
  SONGON-AGBAN) et les grandes communes connues par leurs points
  connectés publics (« Yopougon »).

```bash
curl -s https://suta-bot-web.vercel.app/api/tools/point-connecte \
  -H 'Content-Type: application/json' \
  -d '{"localite": "Songon"}'
```

---

## 3. Signaler une zone sans réseau (ÉCRITURE)

`POST /api/tools/signaler-zone` — crée un signalement citoyen anonyme.

Entrée :

| Champ | Type | Règles |
|---|---|---|
| `localite` | string | requis, 2 à 80 caractères |
| `probleme` | enum | requis : `pas_de_reseau` \| `reseau_instable` \| `pas_internet` \| `autre` |
| `commentaire` | string | optionnel, ≤ 280 caractères — JAMAIS de nom, de téléphone ni d'e-mail |
| `canal` | string | optionnel : `voix` ou `texte` (défaut `texte` ; toute autre valeur est ramenée à `texte`) |

Réponse `200` :

```json
{
  "ok": true,
  "enregistre": true,
  "localiteReconnue": "SONGON-AGBAN",
  "departement": "...",
  "region": "...",
  "pointProche": { "nom": "...", "departement": "...", "distanceKm": 7.4, "lat": 0, "lng": 0 }
}
```

- `localiteReconnue` et `pointProche` valent `null` quand la localité
  n'est pas géolocalisable ; le signalement est enregistré quand même.
- Les signalements sont ANONYMES PAR CONSTRUCTION. L'application
  appelante ne doit transmettre AUCUNE donnée personnelle dans
  `commentaire` — c'est une règle du service, pas une option. Une
  application qui intègre ce point d'accès doit filtrer en amont.

```bash
curl -s https://suta-bot-web.vercel.app/api/tools/signaler-zone \
  -H 'Content-Type: application/json' \
  -d '{"localite": "Niangon", "probleme": "reseau_instable", "canal": "texte"}'
```

---

## Ce que cette API n'est pas

- Pas d'accès aux données d'administration, aux signalements enregistrés
  ni aux fiches non publiques : rien de tout cela n'est exposé.
- Pas de réponse conversationnelle : la voix et la conversation vivent
  dans l'application SUTA. Si un besoin « question → réponse rédigée »
  apparaît pour une application tierce, c'est un nouveau point d'accès à
  cadrer (et à protéger par clé), pas un détournement de ceux-ci.
- L'instance Cockpit (assistant du Directeur général) est une instance
  séparée qui n'est PAS couverte par ce document et n'est pas publique.

## Si l'usage devient officiel

Avant d'intégrer SUTA dans une application en production, prévoir avec
l'équipe : une clé d'API dédiée par application appelante, une limitation
de débit, et un contact technique pour être prévenu des évolutions de
formats. Ces points sont au backlog de l'équipe de reprise (voir
`PASSATION-AGENT.md`, §7).
