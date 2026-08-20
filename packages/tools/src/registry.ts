import { searchKnowledgeTool } from "./search-knowledge";
import type { ToolDefinition } from "./types";

/**
 * Registre des outils activés pour le MVP Salon. Les outils d'écriture
 * (create_request, schedule_appointment, ...) ne doivent PAS être ajoutés
 * ici tant que le MVP Salon est en vigueur (cahier des charges, section 18).
 */
export const SUTA_TOOLS: ToolDefinition[] = [searchKnowledgeTool];

export function findTool(name: string): ToolDefinition | undefined {
  return SUTA_TOOLS.find((tool) => tool.name === name);
}
