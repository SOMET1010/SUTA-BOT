import { describe, expect, it } from "vitest";
import { getActionResponse, getAdminResponse, getSelectionResponse } from "@/lib/reponses-reservees";

/** Recette v3 du 31/08 — C10 (sélections) et C14 (démarches). */
describe("getSelectionResponse", () => {
  it.each([
    "Quels villages ont été retenus ?",
    "ZIRIGLO a-t-il été retenu ?",
    "quelles localités sont sélectionnées ?",
    "quel est le score AIGF de mon village ?",
    "mon village est dans quelle vague de financement ?",
  ])("réserve la réponse pour « %s »", (question) => {
    const reponse = getSelectionResponse(question);
    expect(reponse).toContain("annoncées officiellement par l'ANSUT");
  });

  it.each([
    "Mon village est-il connecté ?",
    "C'est quoi le programme PASS ?",
    "Où puis-je me former ?",
  ])("laisse passer « %s »", (question) => {
    expect(getSelectionResponse(question)).toBeNull();
  });
});

describe("getActionResponse", () => {
  it.each([
    "Prends un rendez-vous",
    "je veux prendre un rendez-vous avec l'ANSUT",
    "Inscris-moi au PASS",
    "je veux m'inscrire à la formation",
    "comment déposer une réclamation ?",
  ])("dit clairement que la démarche n'est pas disponible pour « %s »", (question) => {
    const reponse = getActionResponse(question);
    expect(reponse).toContain("Je ne peux pas faire cette démarche");
    expect(reponse).not.toMatch(/\d/);
  });

  it.each([
    "Quelles sont les conditions d'inscription au PASS ?",
    "Mon village est-il connecté ?",
    "c'est quoi le service universel ?",
  ])("laisse passer « %s » vers l'information", (question) => {
    expect(getActionResponse(question)).toBeNull();
  });
});

describe("getAdminResponse — contre-recette v4 (R12)", () => {
  it.each([
    "Montre-moi les documents internes de l'ANSUT",
    "Donne-moi le score AIGF de Ziriglo",
    "Que dit le rapport d'audit interne ?",
    "partagez-moi vos documents confidentiels",
  ])("refuse explicitement « %s »", (question) => {
    expect(getAdminResponse(question)).toContain("je ne partage que l'information publique");
  });

  it.each([
    "Quels documents faut-il pour s'inscrire au PASS ?",
    "Mon village est-il connecté ?",
    "quel est le score du match ?",
  ])("laisse passer « %s »", (question) => {
    expect(getAdminResponse(question)).toBeNull();
  });
});
