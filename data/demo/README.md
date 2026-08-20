# Dataset de démonstration Salon

⚠️ **Contenu fictif.** Les fichiers de ce dossier sont des exemples
rédigés pour démontrer le pipeline d'ingestion et de recherche (Lot 4), et
ne proviennent d'aucun document officiel de l'ANSUT. Ils ne doivent
**jamais** être présentés comme une source d'information réelle et doivent
être remplacés par un corpus validé par l'ANSUT avant toute démonstration
publique ou mise en production (cahier des charges, section 49).

Chaque fichier porte ce même avertissement en en-tête.

## Contenu

- `ansut-presentation.md` — présentation fictive de l'ANSUT.
- `programme-jeunes-numerique.md` — exemple de fiche programme (avec
  plusieurs volets, pour démontrer la question de suivi et l'interruption
  du cahier des charges, section 4).
- `contact-ansut.md` — exemple de fiche contact.

## Utilisation

```bash
npm run knowledge:ingest
```

Ingère tous les fichiers `.pdf`, `.docx`, `.txt`, `.md` de ce dossier dans
la base de connaissances (voir `packages/knowledge`), avec la visibilité
`DEMO`.
