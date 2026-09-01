import { z } from "zod";
import type { ToolDefinition } from "./types";

/**
 * Outil `point_connecte` — LOT ACTION (démo du 9 septembre) : « où est-ce
 * que ça capte près de chez moi ? ». Depuis une localité nommée, rend sa
 * situation de couverture et les localités couvertes (au moins un site
 * mobile à moins de 3 km, relevé de mai 2026) les plus proches, avec la
 * distance à vol d'oiseau. Lecture seule ; l'exécution réelle vit dans
 * l'Edge Function `point-connecte`.
 */

export const pointConnecteInputSchema = z.object({
  localite: z.string().min(2, "Le nom de la localité est requis.").max(80),
});

export type PointConnecteInput = z.infer<typeof pointConnecteInputSchema>;

export const pointConnecteTool: ToolDefinition<PointConnecteInput, never> = {
  name: "point_connecte",
  description:
    "Trouve, depuis une localité nommée de Côte d'Ivoire, les localités " +
    "couvertes par le réseau mobile les plus proches, avec la distance en " +
    "kilomètres (relevé ANSUT de mai 2026). N'appelle cet outil que quand " +
    "la personne cherche OÙ le réseau capte (près de chez elle, sur sa " +
    "route) — demande le nom de la localité de départ si elle ne l'a pas " +
    "donné. Restitue les distances telles quelles, à vol d'oiseau.",
  inputSchema: pointConnecteInputSchema,
  async execute() {
    // Chemin de production : Edge Function `point-connecte` via
    // /api/tools/point-connecte. Pas de chemin local.
    throw new Error("point_connecte ne s'exécute que via l'Edge Function point-connecte.");
  },
};
