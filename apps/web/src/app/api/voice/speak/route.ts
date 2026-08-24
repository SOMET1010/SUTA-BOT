import { hasValidAdminSession } from "@/lib/admin-auth";
import {
  azureSpeechConfigured,
  construireRequeteTts,
  voiceEngine,
  voixValide,
} from "@/lib/voice/azure-tts";

/** Une phrase à la fois : le lot 3 prononce le texte du cerveau phrase par
 * phrase — une demande plus longue signale un appel hors protocole. */
const MAX_TEXTE = 600;

export async function POST(request: Request) {
  const env = process.env as Record<string, string | undefined>;

  // Tant que le moteur du site est « realtime », cette bouche n'est audible
  // que du labo admin (/admin/voice-lab) : pas de synthèse à nos frais
  // ouverte au public avant la bascule VOICE_ENGINE=azure-tts.
  if (voiceEngine(env) !== "azure-tts" && !(await hasValidAdminSession())) {
    return Response.json({ error: "Session administrateur requise." }, { status: 401 });
  }

  if (!azureSpeechConfigured(env)) {
    return Response.json(
      { error: "Synthèse Azure Speech non configurée (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION)." },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = body && typeof body === "object" ? (body as { text?: unknown; voice?: unknown }) : {};
  const texte = typeof parsed.text === "string" ? parsed.text.trim() : "";
  if (!texte || texte.length > MAX_TEXTE) {
    return Response.json(
      { error: `Le texte à prononcer doit faire entre 1 et ${MAX_TEXTE} caractères.` },
      { status: 400 },
    );
  }
  const voix = voixValide(parsed.voice) ? parsed.voice : undefined;

  try {
    const requete = construireRequeteTts({ texte, voix }, env);
    const azure = await fetch(requete.url, { method: "POST", headers: requete.headers, body: requete.body });
    if (!azure.ok || !azure.body) {
      const detail = await azure.text().catch(() => "");
      console.error("[api/voice/speak] refus Azure Speech", azure.status, detail.slice(0, 300));
      return Response.json(
        { error: `La synthèse vocale a été refusée (HTTP ${azure.status}).` },
        { status: 502 },
      );
    }
    return new Response(azure.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/voice/speak] échec de synthèse", error);
    return Response.json(
      { error: "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer." },
      { status: 503 },
    );
  }
}
