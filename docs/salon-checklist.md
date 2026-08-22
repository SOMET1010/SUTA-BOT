# Checklist Salon

**Adresse de la version en ligne : https://suta-bot-web.vercel.app**
(diagnostics : https://suta-bot-web.vercel.app/admin/diagnostics —
projet Vercel `suta-bot-web`, déployé depuis la branche de travail).

Cahier des charges, section 48. À dérouler avant toute démonstration
publique (idéalement la veille et une dernière fois juste avant
l'ouverture).

## Préparation (une fois)

- [ ] `data/demo/` contient un corpus **validé par l'ANSUT** (plus le
      contenu fictif de développement) — voir section 49 : aucune donnée
      personnelle, confidentielle ou interne.
- [ ] `.env.local` est configuré sur la machine du salon (copie de
      `.env.example`), avec `ADMIN_PASSWORD` renseigné.
- [ ] `npm install && npm run db:migrate && npm run knowledge:ingest`
      exécutés sans erreur sur la machine du salon.

## Checklist du jour

- [ ] **Application démarre** — `npm run build && npm run start` (ou
      l'équivalent de déploiement retenu) sans erreur ; `/` s'affiche.
- [ ] **`/api/health` répond `status: "ok"`** — `curl localhost:3000/api/health`
      (les trois services `database`, `realtime`, `knowledge` doivent être
      `"ok"`).
- [ ] **Microphone détecté** — le navigateur demande/accorde
      l'autorisation micro sur la machine du salon (Chrome/Edge).
      *(Le bouton micro simule actuellement l'écoute ; l'écoute réelle
      arrive avec le Lot 3.)*
- [ ] **Haut-parleurs fonctionnent** — un son de test du système
      d'exploitation est audible sur l'installation du salon.
- [ ] **Session Realtime créée** — `curl -X POST localhost:3000/api/realtime/session`
      renvoie un `sessionId` et un `clientSecret` (jamais une clé
      permanente).
- [ ] **SUTA entend l'utilisateur** — *N/A tant que le Lot 3 n'est pas
      branché.*
- [ ] **SUTA répond** — poser une question du corpus au clavier ; une
      réponse basée sur un document apparaît, avec « Voir les sources ».
- [ ] **Interruption fonctionne** — *N/A tant que le Lot 3 n'est pas
      branché.*
- [ ] **Base documentaire répond** — `/admin/knowledge`, section « Tester
      une question », renvoie des résultats pour une question du corpus.
- [ ] **Question inconnue n'est pas inventée** — poser une question hors
      corpus ; SUTA répond qu'il ne dispose pas de l'information (jamais
      une réponse plausible mais fausse — section 58).
- [ ] **Reset fonctionne** — en mode kiosque, le bouton discret
      « Réinitialiser » (coin bas droit) efface bien la conversation.
- [ ] **Mode kiosque fonctionne** — `?mode=kiosk` masque le pied de page
      technique ; l'inactivité prolongée (`KIOSK_IDLE_RESET_MS`)
      réinitialise automatiquement l'écran.
- [ ] **Fallback fonctionne** — avec `AI_PROVIDER=azure` et
      `DEMO_FALLBACK_MODE=true`, `POST /api/realtime/session` renvoie tout
      de même une session (`provider: "mock"`) même si Azure échoue ; voir
      `/admin/diagnostics` pour le statut des services.

## Accès administration

- [ ] `/admin/login` accessible, connexion avec `ADMIN_PASSWORD` réussie.
- [ ] `/admin/diagnostics` affiche les compteurs de documents/fragments
      attendus et aucune erreur.
- [ ] Accès `/admin/*` refusé sans session valide (redirection vers
      `/admin/login`).

## En cas de problème pendant le salon

1. Vérifier `/admin/diagnostics`.
2. Si la base de connaissances est en erreur : redémarrer PostgreSQL
   (`docker compose restart` ou équivalent) puis recharger la page.
3. Si le Realtime configuré est en erreur et que le fallback est actif
   (`DEMO_FALLBACK_MODE=true`), la démonstration continue automatiquement
   en mode simulation — informer l'équipe mais ne pas interrompre la
   démonstration en cours.
4. En dernier recours : `AI_PROVIDER=mock` dans `.env.local` puis
   redémarrage de l'application.
