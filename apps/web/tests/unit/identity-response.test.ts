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

  it.each([
    // Une question d'identité sur quelqu'un d'AUTRE n'est pas la sienne.
    "C'est qui le directeur de l'ANSUT ?",
    "Qui est le ministre ?",
    "Bonjour, mon village est-il connecté ?",
    "Où me former à Korhogo ?",
  ])("laisse passer « %s » vers la recherche", (question) => {
    expect(getIdentityResponse(question)).toBeNull();
  });
});
