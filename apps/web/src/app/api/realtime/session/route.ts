import { createRealtimeProvider, loadSutaSystemPrompt } from "@suta/ai";

/**
 * Crée une session Realtime temporaire (cahier des charges, section 11).
 *
 * Le navigateur ne reçoit jamais de clé permanente : uniquement un
 * `clientSecret` temporaire et sa date d'expiration, tels que retournés par
 * le `RealtimeProvider` configuré (`AI_PROVIDER`). Les erreurs internes
 * (configuration manquante, provider non implémenté) ne sont jamais
 * renvoyées telles quelles au client (section 33).
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const conversationId =
    body && typeof body === "object" && typeof (body as { conversationId?: unknown }).conversationId === "string"
      ? (body as { conversationId: string }).conversationId
      : undefined;

  try {
    const provider = createRealtimeProvider();
    const session = await provider.createSession({
      conversationId,
      instructions: loadSutaSystemPrompt(),
    });

    return Response.json({
      sessionId: session.sessionId,
      provider: session.provider,
      model: session.model,
      clientSecret: session.clientSecret,
      expiresAt: session.expiresAt,
    });
  } catch (error) {
    console.error("[api/realtime/session] échec de création de session", error);
    return Response.json(
      {
        error:
          "Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.",
      },
      { status: 503 },
    );
  }
}
