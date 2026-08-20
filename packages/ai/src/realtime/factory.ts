import { AzureRealtimeProvider } from "./AzureRealtimeProvider";
import { MockRealtimeProvider } from "./MockRealtimeProvider";
import { OpenAIRealtimeProvider } from "./OpenAIRealtimeProvider";
import type {
  CreateRealtimeSessionOptions,
  RealtimeProvider,
  RealtimeSession,
} from "./types";

export type AiProviderName = "azure" | "openai" | "mock";

export interface RealtimeProviderEnv {
  AI_PROVIDER?: string;
  AZURE_OPENAI_ENDPOINT?: string;
  AZURE_OPENAI_API_KEY?: string;
  REALTIME_DEPLOYMENT?: string;
  AZURE_OPENAI_REGION?: string;
  REALTIME_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_REALTIME_MODEL?: string;
}

/**
 * Instancie le RealtimeProvider configuré via la variable d'environnement
 * `AI_PROVIDER` (cahier des charges, section 9). Aucun fournisseur n'est
 * supposé par défaut autre que `mock`, afin de ne jamais bloquer le
 * développement en l'absence de credentials Azure/OpenAI.
 */
export function createRealtimeProvider(
  env: RealtimeProviderEnv = process.env as RealtimeProviderEnv,
): RealtimeProvider {
  const providerName = (env.AI_PROVIDER || "mock").toLowerCase() as AiProviderName;

  switch (providerName) {
    case "azure":
      return new AzureRealtimeProvider({
        endpoint: env.AZURE_OPENAI_ENDPOINT ?? "",
        apiKey: env.AZURE_OPENAI_API_KEY ?? "",
        deployment: env.REALTIME_DEPLOYMENT ?? "",
        region: env.AZURE_OPENAI_REGION,
        model: env.REALTIME_MODEL,
      });
    case "openai":
      return new OpenAIRealtimeProvider({
        apiKey: env.OPENAI_API_KEY ?? "",
        model: env.OPENAI_REALTIME_MODEL,
      });
    case "mock":
      return new MockRealtimeProvider();
    default:
      throw new Error(
        `AI_PROVIDER inconnu: "${providerName}". Valeurs attendues: azure | openai | mock.`,
      );
  }
}

/**
 * RealtimeProvider qui retombe sur `MockRealtimeProvider` lorsque le
 * fournisseur principal échoue à créer une session (cahier des charges,
 * section 24 : « Si Azure devient momentanément indisponible, l'équipe doit
 * pouvoir basculer le démonstrateur sur le mode simulation »). Le nom
 * rapporté est celui du fournisseur principal ; c'est `RealtimeSession.provider`
 * qui indique si une session donnée a effectivement basculé sur `mock`.
 */
export class FallbackRealtimeProvider implements RealtimeProvider {
  readonly name: string;

  constructor(
    private readonly primary: RealtimeProvider,
    private readonly fallback: RealtimeProvider,
  ) {
    this.name = primary.name;
  }

  async createSession(options?: CreateRealtimeSessionOptions): Promise<RealtimeSession> {
    try {
      return await this.primary.createSession(options);
    } catch (error) {
      console.warn(
        `[FallbackRealtimeProvider] ${this.primary.name} indisponible, bascule sur ` +
          "MockRealtimeProvider (DEMO_FALLBACK_MODE=true).",
        error,
      );
      return this.fallback.createSession(options);
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    await Promise.allSettled([
      this.primary.disconnect(sessionId),
      this.fallback.disconnect(sessionId),
    ]);
  }
}

export interface ResilientRealtimeProviderEnv extends RealtimeProviderEnv {
  DEMO_FALLBACK_MODE?: string;
}

/**
 * Point d'entrée recommandé pour créer des sessions Realtime en production /
 * Salon : identique à `createRealtimeProvider`, mais bascule automatiquement
 * sur `MockRealtimeProvider` si le fournisseur configuré est indisponible —
 * que ce soit dès la construction (configuration invalide) ou lors d'un
 * appel à `createSession` (panne réseau, quota, service indisponible).
 * Désactivable via `DEMO_FALLBACK_MODE=false`.
 */
export function createResilientRealtimeProvider(
  env: ResilientRealtimeProviderEnv = process.env as ResilientRealtimeProviderEnv,
): RealtimeProvider {
  const fallbackEnabled = (env.DEMO_FALLBACK_MODE ?? "true").toLowerCase() !== "false";

  if (!fallbackEnabled) {
    return createRealtimeProvider(env);
  }

  try {
    const primary = createRealtimeProvider(env);
    if (primary.name === "mock") {
      return primary;
    }
    return new FallbackRealtimeProvider(primary, new MockRealtimeProvider());
  } catch (error) {
    console.warn(
      "[createResilientRealtimeProvider] configuration invalide, bascule directement " +
        "sur MockRealtimeProvider (DEMO_FALLBACK_MODE=true).",
      error,
    );
    return new MockRealtimeProvider();
  }
}
