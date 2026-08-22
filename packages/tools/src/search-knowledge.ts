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
  // La première version disait « à utiliser pour toute question » : le modèle
  // obéissait et cherchait à chaque tour, transformant la conversation en FAQ.
  // La description est le premier levier de la discipline d'outil.
  description:
    "Retrouve un fait précis et vérifiable (couverture d'une localité, " +
    "chiffre, programme, condition d'éligibilité, démarche) dans la base de " +
    "connaissances de l'ANSUT. N'appelle cet outil que si la réponse exige " +
    "un fait que tu n'as pas déjà dans la conversation. Jamais pour une " +
    "salutation, une réaction, une clarification ou un fait déjà donné. " +
    "Mets dans query le besoin complet avec son contexte (ex. « formation " +
    "numérique femme senior Korhogo »), pas les mots exacts de la personne. " +
    "Ne présente jamais comme un fait une information absente des résultats.",
  inputSchema: searchKnowledgeInputSchema,
  async execute(input) {
    const { results } = await searchDocuments(input.query, {
      limit: input.limit ?? 5,
      visibility: SEARCH_KNOWLEDGE_VISIBILITY,
    });
    return { results };
  },
};
