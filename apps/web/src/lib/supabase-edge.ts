/**
 * Accès aux Edge Functions Supabase du projet corpus.
 *
 * La clé ci-dessous est la clé PUBLIABLE du projet — conçue pour être
 * exposée. Les tables sont verrouillées par RLS sans policy : cette clé ne
 * permet que d'invoquer les fonctions, et `search-knowledge` impose côté
 * serveur la visibilité PUBLIC+DEMO. Les variables d'environnement du même
 * nom permettent de pointer un autre projet sans toucher au code.
 */
export const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://rnschtjccillctzqnqrb.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_b5IVvRdBqwdPWrqt0NPmxQ_fgTyGn8B";

export function edgeFunctionUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

export function edgeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
  };
}

/**
 * La fonction répond-elle ? Une requête vide déclenche sa validation
 * (« query requis ») : toute réponse JSON — même en erreur — prouve que la
 * fonction tourne, sans payer un embedding à chaque health check.
 */
export async function probeSearchKnowledge(timeoutMs = 4_000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(edgeFunctionUrl("search-knowledge"), {
      method: "POST",
      headers: edgeHeaders(),
      body: "{}",
      signal: controller.signal,
    });
    await response.json();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
