/**
 * Abstraction du fournisseur IA Realtime (voix-à-voix).
 * Voir cahier des charges, section 9.
 *
 * Aucune implémentation ne doit fuiter côté navigateur : `createSession`
 * retourne des informations de connexion temporaires uniquement (jamais de
 * clé permanente).
 */

/**
 * Description d'un outil (function calling) au format JSON Schema,
 * indépendante de tout package d'implémentation d'outils : `packages/ai`
 * ne dépend jamais de `packages/tools`, seul le point de composition
 * (`apps/web`) relie les deux (cahier des charges, section 18).
 */
export interface RealtimeToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CreateRealtimeSessionOptions {
  /** Instructions système à injecter dans la session (prompt SUTA). */
  instructions?: string;
  /** Identifiant de conversation, pour la journalisation (section 29). */
  conversationId?: string;
  /** Outils (function calling) disponibles pour cette session (section 17-18). */
  tools?: RealtimeToolDescriptor[];
}

export interface RealtimeSession {
  /** Identifiant interne de la session, généré par le provider. */
  sessionId: string;
  /** Fournisseur ayant créé la session ("azure" | "openai" | "mock"). */
  provider: string;
  /** Modèle/déploiement utilisé, tel que configuré (jamais de valeur supposée). */
  model: string | null;
  /**
   * Jeton ou identifiant temporaire à transmettre au navigateur pour établir
   * la connexion WebRTC. Ne doit jamais être une clé permanente.
   */
  clientSecret: string;
  /** Date d'expiration ISO 8601 du jeton temporaire. */
  expiresAt: string;
}

export interface RealtimeProvider {
  /** Nom du fournisseur, utilisé pour la journalisation et les diagnostics. */
  readonly name: string;
  /** Crée une session Realtime temporaire. */
  createSession(options?: CreateRealtimeSessionOptions): Promise<RealtimeSession>;
  /** Termine une session Realtime existante. */
  disconnect(sessionId: string): Promise<void>;
}
