# Contrat d'interface `@suta/pass` ↔ couche Android

> Figé au **lot 1** (17/09/2026). La couche Android sera écrite au **lot 3** et
> ne connaîtra de PASS que ce document et `packages/pass/src/bridge.ts`.
> Le but est qu'elle n'ait **rien à renégocier**.

---

## 1. Où passe la frontière

```
  parole
    │
    ▼
┌──────────────────────────── @suta/pass ────────────────────────────┐
│  intentions.ts   routage déterministe, hors ligne, fr + dyu        │
│  actions.ts      schémas zod, extraction, résolution               │
│  confirmation.ts ce que PASS dit avant / pendant / après           │
│  bridge.ts       ─── LE CONTRAT ───                                │
└────────────────────────────────┬───────────────────────────────────┘
                                 │  ActionPass (validée)
                                 ▼
┌───────────────────── couche Android (lot 3) ───────────────────────┐
│  Capacitor · Kotlin · permissions · AudioManager · PackageManager  │
└────────────────────────────────────────────────────────────────────┘
```

**Au-dessus de la frontière** : du TypeScript pur, sans React, sans réseau,
sans plateforme. Testable sans téléphone — c'est ce qui permet aux 75 tests du
lot 1 d'exister avant qu'une seule ligne de Kotlin ne soit écrite.

**En dessous** : tout ce qui touche l'appareil.

---

## 2. Les trois règles de la frontière

1. **Le pont ne reçoit que des entrées déjà validées.** Aucune méthode de
   `PontNatif` ne prend de texte libre. La parole a été routée, extraite et
   vérifiée par un schéma zod avant d'arriver.
2. **Aucune méthode ne lève d'exception attendue.** Permission refusée,
   application absente, appareil photo indisponible sont des `ResultatAction`
   avec `ok: false` et un `code`. Une exception signale un bug, jamais un refus.
3. **`assistance` n'est pas dans l'interface.** Aide, répétition et arrêt se
   traitent entièrement côté conversation. Le pont n'en entend jamais parler —
   et un test le vérifie.

---

## 3. Ce que la couche Android doit implémenter

```ts
interface PontNatif {
  capacites(): Promise<CapacitesPont>;
  appelerContact(entree: { nom: string }): Promise<ResultatAction>;
  ouvrirApplication(entree: { application: string }): Promise<ResultatAction>;
  reglerVolume(entree: { sens: "monter" | "baisser" | "couper" | "definir";
                         niveau?: number }): Promise<ResultatAction>;
  prendrePhoto(entree: { camera: "arriere" | "avant" }): Promise<ResultatAction>;
}
```

### `capacites()`

Appelée **une fois au démarrage**, pas à chaque action. Elle déclare ce que ce
terminal-ci sait réellement faire : permission refusée définitivement, version
d'Android trop ancienne, absence de matériel. PASS s'en sert pour **dire non
avant d'essayer**, plutôt que d'échouer devant la personne.

```ts
interface CapacitesPont {
  appelerContact: boolean;
  ouvrirApplication: boolean;
  reglerVolume: boolean;
  prendrePhoto: boolean;
}
```

### `ResultatAction`

```ts
interface ResultatAction {
  ok: boolean;
  message: string;   // une phrase courte, prête à être DITE — jamais technique
  code?: CodeEchec;  // renseigné si et seulement si ok est faux
  detail?: string;   // pour la journalisation — JAMAIS énoncé à la personne
}
```

`message` vide est permis : PASS retombe alors sur sa phrase générique pour le
`code`. Renseignez-le quand le pont sait dire mieux — « Awa n'est pas dans vos
contacts » vaut mieux que « Je ne trouve pas cela sur ce téléphone ».

### `CodeEchec` — liste **fermée**

| Code | Quand | Ce que PASS dit par défaut |
|---|---|---|
| `permission_refusee` | refus utilisateur, ou permission non accordée | « Je n'ai pas l'autorisation de faire cela sur ce téléphone. » |
| `introuvable` | contact absent, application non installée | « Je ne trouve pas cela sur ce téléphone. » |
| `non_supporte` | appareil ou version d'Android incapable | « Ce téléphone ne sait pas faire cela. » |
| `annule_par_utilisateur` | sortie de l'écran natif | « C'est annulé. » |
| `erreur_interne` | tout le reste | « Cela n'a pas marché. Voulez-vous réessayer ? » |

**Le pont n'invente jamais un code.** La conversation sait répondre à chacun de
ces cinq-là, et à aucun autre.

---

## 4. Ce que la couche Android doit résoudre elle-même

`@suta/pass` rend des **libellés prononcés, normalisés** — sans majuscules, sans
accents, lettres mandingues ramenées à l'ASCII. Il ne rend ni numéro de
téléphone, ni nom de paquet Android. La correspondance appartient au pont :

| Le pont reçoit | Il doit résoudre vers |
|---|---|
| `{ nom: "awa" }` | une entrée du carnet, par comparaison insensible à la casse et aux accents |
| `{ nom: "soeur" }` | idem — noter que `sœur` a été ramené à `soeur` |
| `{ application: "whatsapp" }` | un paquet, via `PackageManager` |
| `{ application: "appareil photo" }` | l'application caméra par défaut |

**Homonymes** : quand plusieurs contacts correspondent, le pont **ne choisit
pas**. Il rend `ok: false`, `code: "introuvable"` et un `message` qui demande
de préciser. Choisir à la place de la personne, c'est appeler le mauvais numéro.

---

## 5. Ce que la couche Android **ne** fait **pas**

- Elle **ne route pas**. `resoudreAction` a déjà décidé.
- Elle **ne valide pas**. Les schémas zod sont passés.
- Elle **ne parle pas**. Les phrases viennent de `confirmation.ts`.
- Elle **ne demande pas confirmation**. `exigeConfirmation` l'a fait en amont —
  quand le pont est appelé, l'accord est déjà donné. En lot 1, une seule action
  l'exige : `appeler_contact`.

---

## 6. Deux implémentations attendues au lot 3

| Fichier | Rôle |
|---|---|
| `apps/pass/src/lib/bridge/capacitor.ts` | la vraie, sur le terminal |
| `apps/pass/src/lib/bridge/mock.ts` | tests vitest et navigateur, sans téléphone |

Le simulateur du lot 1 (`packages/pass/tests/bridge.test.ts`, fonction
`pontSimule`) tient déjà dans une vingtaine de lignes. C'est la preuve que le
contrat est assez petit.

### Rappel des plugins (à vérifier avant installation)

| Besoin | Piste | Statut |
|---|---|---|
| Prendre une photo | `@capacitor/camera` | ✅ officiel |
| Appeler un contact | `@capacitor-community/contacts` | 🔵 à vérifier |
| Régler le volume | **plugin maison Kotlin** (`AudioManager`) | 🔧 à écrire |
| Ouvrir une application | **plugin maison Kotlin** (`PackageManager`) | 🔧 à écrire |

---

## 7. Invariant à ne jamais casser

> **Le chemin hors ligne et le chemin en ligne exécutent le MÊME code.**

- **Hors ligne** : `resoudreAction(parole)` dans la WebView → `ActionPass` → pont.
- **En ligne** : le modèle nomme l'outil → `POST /api/tools/pass` →
  `validerAction` → `ActionPass` → pont.

Deux entrées, **un seul type de sortie**, les mêmes schémas. Un test du lot 1
verrouille l'invariant : toute action produite par `resoudreAction` passe
`validerAction`. Si les deux chemins divergent un jour, ce test tombe.
