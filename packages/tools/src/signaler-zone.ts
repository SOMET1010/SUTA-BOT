import { z } from "zod";
import type { ToolDefinition } from "./types";

/**
 * Outil `signaler_zone` — LOT ACTION (arbitrage Patrick du 02/09, démo du
 * 9 septembre) : le citoyen signale une zone mal connectée, l'ANSUT le voit.
 *
 * Sécurité et données : AUCUNE donnée personnelle — la localité, une
 * catégorie de problème, un commentaire court (purgé de tout motif de
 * numéro de téléphone côté serveur). L'exécution réelle vit dans l'Edge
 * Function `signaler-zone` (même côté que le corpus) ; ce module ne porte
 * que le contrat de l'outil pour la session vocale et la validation.
 */

export const signalerZoneInputSchema = z.object({
  localite: z.string().min(2, "Le nom de la localité est requis.").max(80),
  probleme: z.enum(["pas_de_reseau", "reseau_instable", "pas_internet", "autre"]),
  commentaire: z.string().max(280).optional(),
});

export type SignalerZoneInput = z.infer<typeof signalerZoneInputSchema>;

export const signalerZoneTool: ToolDefinition<SignalerZoneInput, never> = {
  name: "signaler_zone",
  description:
    "Enregistre auprès de l'ANSUT le signalement d'un problème de réseau " +
    "dans une localité (pas de réseau, réseau instable, pas d'internet). " +
    "N'appelle cet outil que si la personne se plaint d'un problème de " +
    "réseau ou demande à le signaler, avec le NOM de la localité — " +
    "demande-le si elle ne l'a pas donné, et confirme son intention avant " +
    "d'enregistrer. Jamais de nom de personne ni de numéro de téléphone " +
    "dans le commentaire. La réponse contient le point couvert le plus " +
    "proche : restitue-le à la personne.",
  inputSchema: signalerZoneInputSchema,
  async execute() {
    // Chemin de production : Edge Function `signaler-zone` via
    // /api/tools/signaler-zone. Pas de chemin local : la table des
    // signalements ne vit que du côté du corpus.
    throw new Error("signaler_zone ne s'exécute que via l'Edge Function signaler-zone.");
  },
};
