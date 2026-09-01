/**
 * Edge Function `signalements-recents` — lecture des signalements citoyens
 * pour le tableau de bord admin (LOT ACTION, démo du 9 septembre).
 *
 * Les données sont anonymes par construction (localité, catégorie, canal,
 * commentaire purgé des numéros). L'accès applicatif passe par
 * /api/admin/signalements, protégé par la session administrateur — cette
 * fonction ne rend que des lignes déjà sans donnée personnelle.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const LIMITE_MAX = 200;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret manquant : ${name}.`);
  return value;
}

Deno.serve(async (req: Request) => {
  try {
    const corps = await req.json().catch(() => ({}));
    const limite = Math.min(Math.max(Number(corps?.limite) || 50, 1), LIMITE_MAX);

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const { data, error } = await supabase
      .from("signalements")
      .select('id, "createdAt", localite, "localiteReconnue", departement, region, lat, lng, probleme, commentaire, canal')
      .order("createdAt", { ascending: false })
      .limit(limite);
    if (error) throw new Error(error.message);

    return Response.json({ ok: true, signalements: data ?? [] });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
