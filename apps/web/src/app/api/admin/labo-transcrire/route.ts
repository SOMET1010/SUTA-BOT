import { hasValidAdminSession } from "@/lib/admin-auth";
import {
  construireRequeteTranscription,
  laboAsrConfigured,
} from "@/lib/langues/labo-langues";

/**
 * Labo langues — relais serveur vers le service de transcription (oreille
 * ivoirienne, modèles Omnilingual ASR hébergés par l'équipe après la
 * migration Azure). Sous /api/admin : protégé par le proxy ET revérifié ici
 * (défense en profondeur, même règle que les autres routes admin).
 *
 * Tant que LABO_ASR_ENDPOINT n'est pas renseignée, la route répond 503 avec
 * le mode d'emploi : le déploiement est inerte, comme VOICE_ENGINE.
 */
export async function POST(request: Request) {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }

  const env = process.env as Record<string, string | undefined>;
  if (!laboAsrConfigured(env)) {
    return Response.json(
      {
        error:
          "Le labo langues n'est pas encore branché : le service de transcription " +
          "sera hébergé sur Azure après la migration (voir la note « SUTA et les " +
          "langues de Côte d'Ivoire »). À renseigner : LABO_ASR_ENDPOINT (et " +
          "LABO_ASR_KEY si le service exige une clé).",
      },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = body && typeof body === "object"
    ? (body as { audio?: unknown; mime?: unknown; code?: unknown })
    : {};
  const audioBase64 = typeof parsed.audio === "string" ? parsed.audio : "";
  const mime = typeof parsed.mime === "string" ? parsed.mime : "";
  const code = typeof parsed.code === "string" ? parsed.code : "";

  try {
    const requete = construireRequeteTranscription({ audioBase64, mime, code }, env);
    const reponse = await fetch(requete.url, {
      method: "POST",
      headers: requete.headers,
      body: requete.body,
    });
    if (!reponse.ok) {
      const detail = await reponse.text().catch(() => "");
      console.error("[api/admin/labo-transcrire] refus du service", reponse.status, detail.slice(0, 300));
      return Response.json(
        { error: `Le service de transcription a refusé la demande (HTTP ${reponse.status}).` },
        { status: 502 },
      );
    }
    const resultat = (await reponse.json().catch(() => null)) as
      | { texte?: unknown; traduction?: unknown }
      | null;
    const texte = typeof resultat?.texte === "string" ? resultat.texte : "";
    if (!texte) {
      return Response.json(
        { error: "Le service n'a pas rendu de transcription (champ « texte » attendu)." },
        { status: 502 },
      );
    }
    return Response.json({
      ok: true,
      texte,
      traduction: typeof resultat?.traduction === "string" ? resultat.traduction : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription impossible.";
    // Les erreurs de validation (langue, format, taille) sont des 400 ; le
    // reste (réseau, service) des 503.
    const statut = /inconnue|refusé|vide ou trop long/.test(message) ? 400 : 503;
    if (statut === 503) console.error("[api/admin/labo-transcrire] échec", error);
    return Response.json({ error: message }, { status: statut });
  }
}
