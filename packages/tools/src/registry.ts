import { pointConnecteTool } from "./point-connecte";
import { searchKnowledgeTool } from "./search-knowledge";
import { signalerZoneTool } from "./signaler-zone";
import type { ToolDefinition } from "./types";

/**
 * Registre des outils activés. Le gel des outils d'écriture du MVP Salon
 * (cahier des charges, section 18) est levé par l'arbitrage Patrick du
 * 02/09 (Lot Action, démo du 9 septembre) pour UN SEUL outil d'écriture :
 * `signaler_zone`, sans aucune donnée personnelle. Les autres outils
 * d'écriture (create_request, schedule_appointment, ...) restent interdits.
 */
export const SUTA_TOOLS: ToolDefinition[] = [searchKnowledgeTool, signalerZoneTool, pointConnecteTool];

export function findTool(name: string): ToolDefinition | undefined {
  return SUTA_TOOLS.find((tool) => tool.name === name);
}
