import { createResilientRealtimeProvider, loadSutaSystemPrompt } from "@suta/ai";
import { SUTA_TOOLS, describeTool } from "@suta/tools";
import { voiceEngine } from "@/lib/voice/azure-tts";

// Les voix réellement servies par gpt-realtime (GA) sur Azure — le casting
// doit pouvoir les auditionner toutes, pas seulement une présélection.
const CASTING_VOICES = new Set([
  "alloy", "ash", "ballad", "cedar", "coral", "echo", "marin", "sage", "shimmer", "verse",
]);

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = body && typeof body === "object" ? (body as { conversationId?: unknown; voice?: unknown }) : {};
  const conversationId = typeof parsed.conversationId === "string" ? parsed.conversationId : undefined;
  const requestedVoice = typeof parsed.voice === "string" && CASTING_VOICES.has(parsed.voice) ? parsed.voice : undefined;

  try {
    const provider = createResilientRealtimeProvider({
      ...(process.env as Record<string, string | undefined>),
      ...(requestedVoice ? { REALTIME_VOICE: requestedVoice } : {}),
    });
    // Lot 3 : en mode azure-tts, le modèle Realtime garde les oreilles et le
    // cerveau mais ne produit que du texte — la voix est synthétisée par
    // Azure Speech côté client (via /api/voice/speak). Défaut : realtime,
    // strictement identique à avant.
    const engine = voiceEngine(process.env as Record<string, string | undefined>);
    const session = await provider.createSession({
      conversationId,
      instructions: loadSutaSystemPrompt(),
      tools: SUTA_TOOLS.map(describeTool),
      ...(engine === "azure-tts" ? { outputModalities: ["text" as const] } : {}),
    });

    return Response.json({
      sessionId: session.sessionId,
      provider: session.provider,
      model: session.model,
      voice: requestedVoice ?? process.env.REALTIME_VOICE ?? "marin",
      voiceEngine: engine,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
      webrtcUrl: session.webrtcUrl ?? null,
    });
  } catch (error) {
    console.error("[api/realtime/session] échec de création de session", error);
    return Response.json(
      { error: "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer." },
      { status: 503 },
    );
  }
}
