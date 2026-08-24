import { createResilientRealtimeProvider, loadSutaSystemPrompt } from "@suta/ai";
import { SUTA_TOOLS, describeTool } from "@suta/tools";

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
    const session = await provider.createSession({
      conversationId,
      instructions: loadSutaSystemPrompt(),
      tools: SUTA_TOOLS.map(describeTool),
    });

    return Response.json({
      sessionId: session.sessionId,
      provider: session.provider,
      model: session.model,
      voice: requestedVoice ?? process.env.REALTIME_VOICE ?? "marin",
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
