import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  signAdminSession,
  verifyAdminPassword,
  verifyAdminSession,
} from "@suta/auth";

export { ADMIN_SESSION_COOKIE };

/**
 * Contrôle d'accès minimal à `/admin` (cahier des charges, section 26) —
 * pas l'authentification Entra ID de la phase 2 (section 57). Désactivé par
 * défaut : sans `ADMIN_PASSWORD`, aucune session ne peut être créée ni
 * validée (échec sûr plutôt qu'un panneau ouvert par accident).
 */

function getAdminSessionSecret(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return process.env.ADMIN_SESSION_SECRET || password;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function checkAdminPassword(candidate: string): boolean {
  if (!process.env.ADMIN_PASSWORD) return false;
  // Deux mots de passe distincts, mêmes droits : celui de Patrick
  // (ADMIN_PASSWORD, requis — c'est lui qui active le panneau) et celui des
  // équipes (ADMIN_PASSWORD_EQUIPE, optionnel). Séparés pour pouvoir
  // révoquer l'accès des équipes en changeant UNE variable Vercel, sans
  // toucher au mot de passe principal. Toujours pas de comptes nominatifs :
  // c'est l'authentification Entra ID de la phase 2 (section 57).
  return [process.env.ADMIN_PASSWORD, process.env.ADMIN_PASSWORD_EQUIPE]
    .filter((p): p is string => Boolean(p))
    .some((p) => verifyAdminPassword(candidate, p));
}

export function issueAdminSessionToken(): string | null {
  const secret = getAdminSessionSecret();
  return secret ? signAdminSession(secret) : null;
}

export function verifyAdminSessionToken(token: string | undefined | null): boolean {
  const secret = getAdminSessionSecret();
  return secret ? verifyAdminSession(token, secret) : false;
}

/**
 * À utiliser dans les Server Components et Route Handlers admin, en plus de
 * la vérification faite par `proxy.ts` (défense en profondeur — voir la
 * documentation Next.js sur l'authentification : Proxy ne doit jamais être
 * la seule ligne de défense).
 */
export async function hasValidAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}
