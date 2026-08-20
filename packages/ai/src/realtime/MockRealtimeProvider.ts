import type {
  CreateRealtimeSessionOptions,
  RealtimeProvider,
  RealtimeSession,
} from "./types";

const SESSION_TTL_MS = 5 * 60 * 1000;

/**
 * Implémentation simulée du RealtimeProvider, utilisée en développement et
 * comme fallback Salon (`DEMO_FALLBACK_MODE=true`, cahier des charges
 * section 24) lorsque le fournisseur Azure/OpenAI est indisponible.
 *
 * Ne réalise aucun appel réseau : génère des sessions factices en mémoire.
 */
export class MockRealtimeProvider implements RealtimeProvider {
  readonly name = "mock";
  private readonly activeSessions = new Set<string>();

  async createSession(
    options?: CreateRealtimeSessionOptions,
  ): Promise<RealtimeSession> {
    const sessionId = `mock_${crypto.randomUUID()}`;
    this.activeSessions.add(sessionId);

    return {
      sessionId,
      provider: this.name,
      model: "mock-realtime-model",
      clientSecret: `mock_secret_${crypto.randomUUID()}`,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    };
  }

  async disconnect(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);
  }

  /** Utilitaire de test/diagnostic : sessions actuellement ouvertes. */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
}
