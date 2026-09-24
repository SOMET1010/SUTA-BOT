import { hasValidAdminSession } from "@/lib/admin-auth";
import { azureSpeechConfigured, construireRequeteVoix, filtrerVoix } from "@/lib/voice/azure-tts";

/**
 * Les voix que la ressource Azure Speech offre réellement.
 *
 * Réservée à l'administration : c'est un outil de casting, pas un point
 * d'accès public. La clé ne quitte jamais le serveur.
 */
const TIMEOUT_MS = 9_000;

export async function GET() {
  if (!(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }
  const env = process.env as Record<string, string | undefined>;
  if (!azureSpeechConfigured(env)) {
    return Response.json(
      { error: "Synthèse Azure Speech non configurée (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)." },
      { status: 503 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { url, headers } = construireRequeteVoix(env);
    const reponse = await fetch(url, { headers, signal: controller.signal });
    if (!reponse.ok) {
      return Response.json(
        { error: `Azure Speech a répondu ${reponse.status}.` },
        { status: 502 },
      );
    }
    const brut: unknown = await reponse.json();
    const francaises = filtrerVoix(brut, ["fr"]);
    return Response.json({
      voix: francaises,
      total: Array.isArray(brut) ? brut.length : 0,
      locales: [...new Set(francaises.map((v) => v.locale))].sort(),
    });
  } catch {
    return Response.json({ error: "Liste des voix indisponible." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
