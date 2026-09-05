import { describe, expect, it } from "vitest";
import { getIdentityResponse } from "@/lib/identity-response";

/**
 * Terrain du 31/08 : « QUI EST TU ? » (transcription vocale, sans trait
 * d'union, conjugaison approximative) recevait le repli « je n'ai pas
 * d'information fiable » au lieu de la présentation de SUTA.
 */
describe("getIdentityResponse", () => {
  it.each([
    "Qui es-tu ?",
    "QUI ES TU ?",
    "QUI EST TU ?",
    "Qui êtes-vous ?",
    "qui etes vous",
    "Tu es qui ?",
    "T'es qui ?",
    "C'est quoi SUTA ?",
    "SUTA c'est quoi ?",
    "Qui est SUTA ?",
    "Présente-toi",
    "présentez-vous",
    "Bonjour",
    "Bonjour SUTA !",
  ])("répond à la question d'identité « %s »", (question) => {
    expect(getIdentityResponse(question)).toContain("Je suis SUTA");
  });

  /**
   * Terrain du 04/09 (test DSIS) : « mentionne ANSUT CONNECTE sans être en
   * mesure de l'expliquer » et « ne connaît pas l'identité de l'actuel
   * Directeur général de l'ANSUT ». Deux réponses déterministes de plus.
   */
  it.each([
    "C'est quoi ANSUT CONNECTE ?",
    "c'est quoi ansut connecté",
    "Qu'est-ce que ANSUT CONNECTE ?",
    "ANSUT CONNECTE, ça veut dire quoi ?",
    "Explique-moi ANSUT CONNECTE",
  ])("explique ANSUT CONNECTE : « %s »", (question) => {
    expect(getIdentityResponse(question)).toContain("ANSUT CONNECTE est le dispositif");
  });

  it.each([
    "Qui est le Directeur général de l'ANSUT ?",
    "C'est qui le directeur de l'ANSUT ?",
    "c'est qui le DG ?",
    "Qui dirige l'ANSUT ?",
    "Quel est le nom du DG de l'ANSUT ?",
  ])("nomme le Directeur général : « %s »", (question) => {
    expect(getIdentityResponse(question)).toContain("Gilles Thierry Beugré");
  });

  it.each([
    // Une question d'identité sur quelqu'un d'AUTRE n'est pas la sienne.
    "Qui est le ministre ?",
    "Bonjour, mon village est-il connecté ?",
    "Où me former à Korhogo ?",
    // ANSUT tout court (missions, programmes) reste du ressort de la recherche.
    "C'est quoi l'ANSUT ?",
    "Que fait l'ANSUT pour les villages ?",
  ])("laisse passer « %s » vers la recherche", (question) => {
    expect(getIdentityResponse(question)).toBeNull();
  });
});
