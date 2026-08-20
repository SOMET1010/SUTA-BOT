import { AzureRealtimeProvider } from "./AzureRealtimeProvider";
import { MockRealtimeProvider } from "./MockRealtimeProvider";
import { OpenAIRealtimeProvider } from "./OpenAIRealtimeProvider";
import type { RealtimeProvider } from "./types";

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
