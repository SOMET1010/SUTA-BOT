import { describe, expect, it } from "vitest";

import {
  VOIX_TEST_STANDARD,
  azureSpeechConfigured,
  construireRequeteTts,
  voiceEngine,
  voixValide,
} from "@/lib/voice/azure-tts";

const ENV = { AZURE_SPEECH_KEY: "cle-test", AZURE_SPEECH_REGION: "westeurope" };

describe("voiceEngine — l'interrupteur du lot 3 est inerte par défaut", () => {
  it("retombe sur realtime sans variable, avec une valeur vide ou une faute de frappe", () => {
    expect(voiceEngine({})).toBe("realtime");
    expect(voiceEngine({ VOICE_ENGINE: "" })).toBe("realtime");
    expect(voiceEngine({ VOICE_ENGINE: "azure_tts" })).toBe("realtime");
    expect(voiceEngine({ VOICE_ENGINE: "AZURE-TTS" })).toBe("realtime");
  });

  it("ne bascule que sur la valeur exacte azure-tts", () => {
    expect(voiceEngine({ VOICE_ENGINE: "azure-tts" })).toBe("azure-tts");
  });
});

describe("azureSpeechConfigured", () => {
  it("exige la clé ET une région ou un endpoint", () => {
    expect(azureSpeechConfigured({})).toBe(false);
    expect(azureSpeechConfigured({ AZURE_SPEECH_KEY: "k" })).toBe(false);
    expect(azureSpeechConfigured({ AZURE_SPEECH_REGION: "westeurope" })).toBe(false);
    expect(azureSpeechConfigured(ENV)).toBe(true);
    expect(
      azureSpeechConfigured({ AZURE_SPEECH_KEY: "k", AZURE_SPEECH_ENDPOINT: "https://westeurope.api.cognitive.microsoft.com/" }),
    ).toBe(true);
  });
});

describe("construireRequeteTts", () => {
  it("vise l'endpoint TTS de la région, pas l'endpoint de gestion", () => {
    const r = construireRequeteTts({ texte: "Bonjour" }, ENV);
    expect(r.url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
  });

  it("déduit la région du endpoint IT quand seule elle manque", () => {
    const r = construireRequeteTts(
      { texte: "Bonjour" },
      { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_ENDPOINT: "https://westeurope.api.cognitive.microsoft.com/" },
    );
    expect(r.url).toBe("https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1");
  });

  it("porte la clé dans l'en-tête et un format mono 24 kHz", () => {
    const r = construireRequeteTts({ texte: "Bonjour" }, ENV);
    expect(r.headers["Ocp-Apim-Subscription-Key"]).toBe("cle-test");
    expect(r.headers["X-Microsoft-OutputFormat"]).toContain("24khz");
  });

  it("échappe le texte dans le SSML — rien du citoyen ne devient du balisage", () => {
    const r = construireRequeteTts({ texte: `<script> & "l'ANSUT"` }, ENV);
    expect(r.body).not.toContain("<script>");
    expect(r.body).toContain("&lt;script&gt; &amp; &quot;l&apos;ANSUT&quot;");
  });

  it("voix : la demande prime, puis AZURE_SPEECH_VOICE, puis la bouche de test", () => {
    expect(construireRequeteTts({ texte: "x" }, ENV).body).toContain(`name="${VOIX_TEST_STANDARD}"`);
    expect(
      construireRequeteTts({ texte: "x" }, { ...ENV, AZURE_SPEECH_VOICE: "fr-FR-VivienneMultilingualNeural" }).body,
    ).toContain('name="fr-FR-VivienneMultilingualNeural"');
    expect(
      construireRequeteTts({ texte: "x", voix: "JulabaNeural" }, { ...ENV, AZURE_SPEECH_VOICE: "fr-FR-DeniseNeural" }).body,
    ).toContain('name="JulabaNeural"');
  });

  it("un nom de voix hors format est ignoré, jamais injecté dans le SSML", () => {
    expect(voixValide('x"><voice')).toBe(false);
    const r = construireRequeteTts({ texte: "x", voix: 'x"><voice' }, ENV);
    expect(r.body).toContain(`name="${VOIX_TEST_STANDARD}"`);
  });

  it("refuse net une configuration incomplète", () => {
    expect(() => construireRequeteTts({ texte: "x" }, { AZURE_SPEECH_REGION: "westeurope" })).toThrow();
  });
});
