import type {
  CreateRealtimeSessionOptions,
  RealtimeProvider,
  RealtimeSession,
  RealtimeToolDescriptor,
} from "./types";

const SESSION_TTL_MS = 5 * 60 * 1000;

/**
 * Implémentation simulée du RealtimeProvider, utilisée en développement et
 * comme fallback Salon (`DEMO_FALLBACK_MODE=true`, cahier des charges
 * section 24) lorsque le fournisseur Azure/OpenAI est indisponible.
 *
 * Ne réalise aucun appel réseau : génère des sessions factices en mémoire.
 * Les outils transmis à `createSession` sont mémorisés (mais jamais
 * exécutés ici) afin de permettre au reste du système de vérifier qu'ils
 * ont bien été enregistrés pour la session.
 */
export class MockRealtimeProvider implements RealtimeProvider {
  readonly name = "mock";
  private readonly activeSessions = new Map<string, RealtimeToolDescriptor[]>();

  async createSession(
    options?: CreateRealtimeSessionOptions,
  ): Promise<RealtimeSession> {
    const sessionId = `mock_${crypto.randomUUID()}`;
    this.activeSessions.set(sessionId, options?.tools ?? []);

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

  /** Utilitaire de test/diagnostic : outils enregistrés pour une session. */
  getRegisteredTools(sessionId: string): RealtimeToolDescriptor[] | undefined {
    return this.activeSessions.get(sessionId);
  }
}
