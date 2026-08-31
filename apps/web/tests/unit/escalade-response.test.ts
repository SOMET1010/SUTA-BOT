import { describe, expect, it } from "vitest";
import { getEscaladeResponse } from "@/lib/escalade-response";

/**
 * Recette DTDI du 31/08, constat A-02 : « je veux parler à un conseiller
 * humain » recevait un article sur les usages de l'IA dans l'administration.
 */
describe("getEscaladeResponse", () => {
  it.each([
    "Je veux parler à un conseiller humain",
    "je veux parler à un conseiller",
    "Puis-je joindre un agent ?",
    "Je voudrais discuter avec quelqu'un",
    "je veux parler à une vraie personne",
    "comment contacter un responsable ?",
    "passez-moi le service client",
    "je préfère un humain",
  ])("reconnaît la demande d'escalade « %s »", (question) => {
    const reponse = getEscaladeResponse(question);
    expect(reponse).toContain("l'équipe présente sur le stand");
    // Aucun canal inventé : pas de numéro ni d'horaires dans la réponse.
    expect(reponse).not.toMatch(/\d/);
  });

  it.each([
    // « agent », « conseiller » hors demande de contact : pas d'escalade.
    "Que font les agents de l'ANSUT sur le terrain ?",
    "Mon village est-il connecté ?",
    "Quels conseils pour protéger mes données ?",
    "L'humain est au cœur du numérique ?",
  ])("laisse passer « %s » vers la conversation normale", (question) => {
    expect(getEscaladeResponse(question)).toBeNull();
  });
});
