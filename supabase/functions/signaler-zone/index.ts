/**
 * Edge Function `signaler-zone` — LOT ACTION (démo du 9 septembre).
 *
 * Le citoyen signale une zone mal connectée ; l'ANSUT le voit. La réponse
 * porte aussi le point couvert le plus proche : la chaîne voulue par le
 * produit — le citoyen signale → SUTA comprend → l'oriente vers une
 * solution concrète.
 *
 * DONNÉES : AUCUNE donnée personnelle. Localité, catégorie de problème,
 * commentaire court dont tout motif de numéro de téléphone est retiré
 * avant insertion, canal. La table est verrouillée par RLS sans policy :
 * seul le service role (ici) y écrit.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const PROBLEMES = new Set(["pas_de_reseau", "reseau_instable", "pas_internet", "autre"]);
const CANAUX = new Set(["texte", "voix"]);
const LOCALITE_MAX = 80;
const COMMENTAIRE_MAX = 280;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret manquant : ${name}.`);
  return value;
}

/** Zéro donnée personnelle : toute suite évoquant un numéro de téléphone
 * est retirée du commentaire avant stockage. */
function purgerNumeros(texte: string): string {
  return texte.replace(/\+?\d[\d .\-()]{6,}\d/g, "[numéro retiré]");
}

Deno.serve(async (req: Request) => {
  try {
    const corps = await req.json();
    const localite = typeof corps?.localite === "string" ? corps.localite.trim().slice(0, LOCALITE_MAX) : "";
    const probleme = typeof corps?.probleme === "string" && PROBLEMES.has(corps.probleme) ? corps.probleme : "autre";
    const canal = typeof corps?.canal === "string" && CANAUX.has(corps.canal) ? corps.canal : "texte";
    const commentaire = typeof corps?.commentaire === "string" && corps.commentaire.trim().length > 0
      ? purgerNumeros(corps.commentaire.trim().slice(0, COMMENTAIRE_MAX))
      : null;
    if (localite.length < 2) throw new Error("Paramètre « localite » requis.");

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: resolue } = await supabase.rpc("resoudre_localite", { nom_brut: localite });
    const lieu = Array.isArray(resolue) && resolue.length > 0 ? resolue[0] : null;

    const { error: insertError } = await supabase.from("signalements").insert({
      localite,
      localiteReconnue: lieu?.nom ?? null,
      departement: lieu?.departement ?? null,
      region: lieu?.region ?? null,
      lat: lieu?.lat ?? null,
      lng: lieu?.lng ?? null,
      probleme,
      commentaire,
      canal,
    });
    if (insertError) throw new Error(`Enregistrement : ${insertError.message}`);

    // L'orientation qui suit le signalement : le point couvert le plus
    // proche, quand la localité est reconnue et géolocalisée.
    let pointProche = null;
    if (lieu && typeof lieu.lat === "number" && typeof lieu.lng === "number") {
      const { data: proches } = await supabase.rpc("points_connectes_proches", {
        p_lat: lieu.lat, p_lng: lieu.lng, k: 1,
      });
      if (Array.isArray(proches) && proches.length > 0) {
        const p = proches[0];
        pointProche = { nom: p.nom, departement: p.departement, distanceKm: p.distance_km, lat: p.lat, lng: p.lng };
      }
    }

    return Response.json({
      ok: true,
      enregistre: true,
      localiteReconnue: lieu?.nom ?? null,
      departement: lieu?.departement ?? null,
      region: lieu?.region ?? null,
      pointProche,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
