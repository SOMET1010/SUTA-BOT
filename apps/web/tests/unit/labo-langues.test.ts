import { describe, expect, it } from "vitest";
import {
  LANGUES_LABO,
  MAX_AUDIO_BASE64,
  construireRequeteTranscription,
  laboAsrConfigured,
  langueDuLabo,
  mimeAudioValide,
} from "@/lib/langues/labo-langues";

/**
 * Laboratoire langues (10/09) : l'oreille ivoirienne de SUTA, jugée par des
 * oreilles ivoiriennes. La liste des 22 langues vient de la liste officielle
 * du modèle Omnilingual ASR (vérifiée le 09-10/09) — pas d'une intuition.
 */
describe("labo langues — la liste vérifiée", () => {
  it("porte les 22 langues, dioula en tête", () => {
    expect(LANGUES_LABO).toHaveLength(22);
    expect(LANGUES_LABO[0]).toMatchObject({ code: "dyu", nom: "Dioula" });
  });

  it("marque la bouche disponible là où la synthèse MMS existe (dyu, bam, any, mos)", () => {
    const avecBouche = LANGUES_LABO.filter((l) => l.synthese).map((l) => l.code).sort();
    expect(avecBouche).toEqual(["any", "bam", "dyu", "mos"]);
  });

  it("retrouve une langue par code et rejette le reste", () => {
    expect(langueDuLabo("bci")?.nom).toBe("Baoulé");
    expect(langueDuLabo("fra")).toBeNull();
    expect(langueDuLabo(42)).toBeNull();
  });
});

describe("labo langues — la requête vers le service", () => {
  const env = { LABO_ASR_ENDPOINT: "https://exemple.ansut.ci/asr", LABO_ASR_KEY: "secret" };

  it("n'est branché que lorsque l'endpoint est renseigné", () => {
    expect(laboAsrConfigured({})).toBe(false);
    expect(laboAsrConfigured(env)).toBe(true);
  });

  it("construit la requête au contrat : lang au format code_Latn, clé en Bearer", () => {
    const r = construireRequeteTranscription({ audioBase64: "QUJD", mime: "audio/webm", code: "dyu" }, env);
    expect(r.url).toBe(env.LABO_ASR_ENDPOINT);
    expect(r.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(r.body)).toEqual({ audio: "QUJD", mime: "audio/webm", lang: "dyu_Latn" });
  });

  it("sans clé, aucun entête Authorization ne part", () => {
    const r = construireRequeteTranscription(
      { audioBase64: "QUJD", mime: "audio/ogg", code: "bci" },
      { LABO_ASR_ENDPOINT: "https://exemple.ansut.ci/asr" },
    );
    expect(r.headers.Authorization).toBeUndefined();
  });

  it("refuse langue inconnue, format exotique et audio trop long", () => {
    expect(() => construireRequeteTranscription({ audioBase64: "QUJD", mime: "audio/webm", code: "fra" }, env)).toThrow(/inconnue/);
    expect(() => construireRequeteTranscription({ audioBase64: "QUJD", mime: "video/mp4", code: "dyu" }, env)).toThrow(/refusé/);
    expect(() => construireRequeteTranscription({ audioBase64: "x".repeat(MAX_AUDIO_BASE64 + 1), mime: "audio/webm", code: "dyu" }, env)).toThrow(/trop long/);
  });

  it("accepte les mimes des navigateurs, avec ou sans paramètres", () => {
    expect(mimeAudioValide("audio/webm;codecs=opus")).toBe(true);
    expect(mimeAudioValide("audio/mp4")).toBe(true);
    expect(mimeAudioValide("text/plain")).toBe(false);
  });
});
