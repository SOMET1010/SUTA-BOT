import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Contrôle d'accès minimal pour `/admin` (cahier des charges, section 26).
 *
 * Ce n'est PAS l'authentification Entra ID prévue en phase 2 (section 57) :
 * il n'y a ni modèle utilisateur ni rôles, seulement un mot de passe
 * partagé qui protège le panneau d'administration du MVP Salon. Le jeton
 * de session est signé (HMAC) et sans état (aucune session stockée côté
 * serveur), volontairement simple pour un usage à un seul opérateur.
 */

export const ADMIN_SESSION_COOKIE = "suta_admin_session";
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — durée d'un salon

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Compare deux mots de passe en temps constant (évite les attaques temporelles). */
export function verifyAdminPassword(candidate: string, expected: string): boolean {
  const candidateDigest = createHash("sha256").update(candidate).digest("hex");
  const expectedDigest = createHash("sha256").update(expected).digest("hex");
  return timingSafeEqualHex(candidateDigest, expectedDigest);
}

/** Émet un jeton de session signé, valable `ttlMs` millisecondes. */
export function signAdminSession(secret: string, ttlMs = DEFAULT_SESSION_TTL_MS): string {
  const expiresAt = Date.now() + ttlMs;
  const signature = createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${signature}`;
}

/** Vérifie un jeton de session : signature valide et non expiré. */
export function verifyAdminSession(token: string | undefined | null, secret: string): boolean {
  if (!token) return false;
  const [expiresAtRaw, signature] = token.split(".");
  if (!expiresAtRaw || !signature) return false;

  const expected = createHmac("sha256", secret).update(expiresAtRaw).digest("hex");
  if (!timingSafeEqualHex(signature, expected)) return false;

  const expiresAt = Number(expiresAtRaw);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}
