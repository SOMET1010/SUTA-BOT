import { z } from "zod";
import { searchDocuments } from "@suta/knowledge";
import type { SearchResultLocation } from "@suta/knowledge";
import type { ToolDefinition } from "./types";

/**
 * Outil `searchKnowledge` (cahier des charges, section 17).
 *
 * Sécurité : le niveau de visibilité n'est PAS un paramètre exposé au
 * modèle. Le laisser choisir la visibilité (ex. "ADMIN") permettrait de
 * contourner les permissions par une simple instruction dans la
 * conversation. Pour le MVP Salon (utilisateurs anonymes, pas encore
 * d'authentification), la recherche est donc toujours restreinte à
 * `PUBLIC`/`DEMO` côté serveur (section 19). Une fois l'authentification
 * Entra ID en place (section 57), ce niveau proviendra du contexte serveur
 * de la session, jamais de l'entrée du modèle.
 */

const SEARCH_KNOWLEDGE_VISIBILITY = ["PUBLIC", "DEMO"];

export const searchKnowledgeInputSchema = z.object({
  query: z.string().min(1, "La question ne peut pas être vide.").max(500),
  limit: z.number().int().min(1).max(10).optional(),
});

export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeInputSchema>;

export type SearchKnowledgeResultLocation = SearchResultLocation;

export interface SearchKnowledgeResult {
  title: string;
  content: string;
  source: string;
  score: number;
  /** Coordonnées géographiques, quand le fragment en porte (cartographie). */
  location?: SearchKnowledgeResultLocation;
}

export interface SearchKnowledgeOutput {
  results: SearchKnowledgeResult[];
}

export const searchKnowledgeTool: ToolDefinition<SearchKnowledgeInput, SearchKnowledgeOutput> = {
  name: "search_knowledge",
  description:
    "Recherche des informations dans la base de connaissances de l'ANSUT " +
    "(programmes, services, procédures, contacts). À utiliser pour toute " +
    "question portant sur des informations institutionnelles de l'ANSUT. " +
    "Ne jamais présenter comme un fait une information absente des résultats.",
  inputSchema: searchKnowledgeInputSchema,
  async execute(input) {
    const { results } = await searchDocuments(input.query, {
      limit: input.limit ?? 5,
      visibility: SEARCH_KNOWLEDGE_VISIBILITY,
    });
    return { results };
  },
};
