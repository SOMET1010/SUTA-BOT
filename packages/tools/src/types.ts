import { z } from "zod";

/**
 * Un outil appelable par SUTA via function calling (cahier des charges,
 * sections 17-18, 31). Chaque outil doit valider son entrée, vérifier les
 * permissions, exécuter une opération précise et ne retourner que les
 * données nécessaires.
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  execute(input: TInput): Promise<TOutput>;
}

/** Description au format attendu par un moteur Realtime (JSON Schema). */
export interface RealtimeToolDescriptor {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export function describeTool(tool: ToolDefinition): RealtimeToolDescriptor {
  return {
    name: tool.name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
  };
}

export class ToolInputError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
  ) {
    super(message);
    this.name = "ToolInputError";
  }
}

/** Valide l'entrée brute (ex. JSON envoyé par le moteur Realtime) avant exécution. */
export async function runTool<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
  rawInput: unknown,
): Promise<TOutput> {
  const parsed = tool.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new ToolInputError(
      tool.name,
      `Entrée invalide pour l'outil "${tool.name}" : ${parsed.error.message}`,
    );
  }
  return tool.execute(parsed.data);
}
