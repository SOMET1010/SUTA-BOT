# packages/auth

Contrôle d'accès minimal à `/admin` (cahier des charges, section 26).

**Ce n'est pas l'authentification Entra ID** prévue en phase 2 (section
57) : il n'y a ni modèle utilisateur ni rôles, seulement un mot de passe
partagé (`ADMIN_PASSWORD`) qui protège le panneau d'administration du MVP
Salon, pensé pour un seul opérateur.

## Fonctionnement

- `verifyAdminPassword(candidate, expected)` — comparaison en temps
  constant (empreintes SHA-256, `timingSafeEqual`).
- `signAdminSession(secret)` / `verifyAdminSession(token, secret)` — jeton
  de session signé par HMAC-SHA256, sans état côté serveur (aucune session
  stockée), valable 12h par défaut.

Désactivé par défaut : sans `ADMIN_PASSWORD`, aucune session ne peut être
émise ni validée — échec sûr plutôt qu'un panneau ouvert par accident.

Utilisé par `apps/web/src/proxy.ts` (Next.js 16 — anciennement
Middleware) et `apps/web/src/lib/admin-auth.ts`.
