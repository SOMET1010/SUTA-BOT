import { describe, expect, it } from "vitest";
import {
  ACCES_PILOTE,
  COCKPIT_TOOL_DESCRIPTOR,
  accesDuPilote,
  cockpitConfigure,
  construireRequeteCockpit,
  dateEnFrancais,
  formulerALaVoix,
  modeCockpitActif,
  reponseSimulee,
  validerEnveloppe,
} from "@/lib/cockpit/contrat";

/**
 * SUTA Cockpit (11/09) : le contrat accepté avec le développeur Cockpit,
 * dont son exigence n°5 — le champ périmètre. La règle est déterministe et
 * donc testée : un chiffre partiel s'énonce AVEC son périmètre, une valeur
 * non publiable rend sa raison, une enveloppe non conforme n'est pas dite.
 */
describe("cockpit — le mode et le pilote", () => {
  it("est inerte par défaut : sans SUTA_MODE, rien ne change pour l'instance citoyenne", () => {
    expect(modeCockpitActif({})).toBe(false);
    expect(modeCockpitActif({ SUTA_MODE: "citoyen" })).toBe(false);
    expect(modeCockpitActif({ SUTA_MODE: "Cockpit" })).toBe(true);
  });

  it("le pilote est resserré à trois accès — etat-projet reste dehors", () => {
    expect([...ACCES_PILOTE]).toEqual(["indicateur", "alertes-du-jour", "synthese-matinale"]);
    expect(accesDuPilote("etat-projet")).toBeNull();
    expect(accesDuPilote("alertes-du-jour")).toBe("alertes-du-jour");
    const schema = COCKPIT_TOOL_DESCRIPTOR.parameters as { properties: { acces: { enum: string[] } } };
    expect(schema.properties.acces.enum).not.toContain("etat-projet");
  });

  it("n'est branché que lorsque COCKPIT_API_BASE est renseignée", () => {
    expect(cockpitConfigure({})).toBe(false);
    expect(cockpitConfigure({ COCKPIT_API_BASE: "simulation" })).toBe(true);
  });
});

describe("cockpit — l'enveloppe est contrôlée avant d'être énoncée", () => {
  const conforme = {
    publiable: true,
    a_dire: "Le taux fictif est de douze pour cent.",
    date_donnees: "2026-09-10",
    perimetre: { complet: true },
    source: "test",
  };

  it("accepte une enveloppe conforme, refuse tout manquement au contrat", () => {
    expect(validerEnveloppe(conforme).ok).toBe(true);
    expect(validerEnveloppe(null)).toMatchObject({ ok: false });
    expect(validerEnveloppe({ ...conforme, a_dire: " " })).toMatchObject({ ok: false, motif: expect.stringContaining("a_dire") });
    expect(validerEnveloppe({ ...conforme, date_donnees: "10/09/2026" })).toMatchObject({ ok: false, motif: expect.stringContaining("date_donnees") });
    expect(validerEnveloppe({ ...conforme, perimetre: undefined })).toMatchObject({ ok: false, motif: expect.stringContaining("perimetre") });
    expect(validerEnveloppe({ ...conforme, source: "" })).toMatchObject({ ok: false, motif: expect.stringContaining("source") });
  });

  it("un périmètre partiel exige son libellé ; une valeur non publiable exige sa raison", () => {
    expect(validerEnveloppe({ ...conforme, perimetre: { complet: false } })).toMatchObject({ ok: false, motif: expect.stringContaining("libellé") });
    expect(validerEnveloppe({ publiable: false })).toMatchObject({ ok: false, motif: expect.stringContaining("raison") });
    expect(validerEnveloppe({ publiable: false, raison: "source débranchée" }).ok).toBe(true);
  });
});

describe("cockpit — la règle du périmètre à la voix", () => {
  it("chiffre complet : la formulation, puis la date d'arrêté", () => {
    const voix = formulerALaVoix({
      publiable: true,
      a_dire: "Le taux fictif est de soixante-deux pour cent",
      date_donnees: "2026-09-01",
      perimetre: { complet: true },
      source: "test",
    });
    expect(voix).toBe("Le taux fictif est de soixante-deux pour cent. Chiffres arrêtés au 1er septembre 2026.");
  });

  it("chiffre partiel : le périmètre est énoncé AVEC le chiffre, jamais tu", () => {
    const voix = formulerALaVoix({
      publiable: true,
      a_dire: "Le taux fictif est de douze pour cent.",
      date_donnees: "2026-09-10",
      perimetre: { complet: false, libelle: "trois directions instruites sur sept" },
      source: "test",
    });
    expect(voix).toContain("Attention, périmètre partiel : trois directions instruites sur sept.");
    expect(voix).toContain("Chiffres arrêtés au 10 septembre 2026.");
  });

  it("valeur non publiable : la raison, jamais le chiffre", () => {
    const voix = formulerALaVoix({ publiable: false, raison: "la source est débranchée." });
    expect(voix).toBe("Je ne peux pas énoncer ce chiffre : la source est débranchée.");
  });

  it("écrit les dates en français", () => {
    expect(dateEnFrancais("2026-01-01")).toBe("1er janvier 2026");
    expect(dateEnFrancais("2026-08-24")).toBe("24 août 2026");
  });
});

describe("cockpit — la simulation respecte elle-même le contrat", () => {
  it("chaque accès du pilote rend une enveloppe conforme (données fictives)", () => {
    for (const acces of ACCES_PILOTE) {
      const enveloppe = reponseSimulee(acces, acces === "indicateur" ? "test-complet" : undefined);
      expect(validerEnveloppe(enveloppe).ok).toBe(true);
    }
    expect(reponseSimulee("indicateur", "test-partiel").perimetre?.complet).toBe(false);
    expect(reponseSimulee("indicateur", "test-non-publiable").publiable).toBe(false);
    expect(reponseSimulee("indicateur", "nexiste-pas").publiable).toBe(false);
  });
});

describe("cockpit — la requête vers les points d'accès", () => {
  it("construit l'URL par accès et porte la clé en Bearer", () => {
    const r = construireRequeteCockpit(
      { acces: "indicateur", indicateur: "test-complet" },
      { COCKPIT_API_BASE: "https://exemple.ansut.ci/cockpit/", COCKPIT_API_KEY: "secret" },
    );
    expect(r.url).toBe("https://exemple.ansut.ci/cockpit/indicateur");
    expect(r.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(r.body)).toEqual({ indicateur: "test-complet" });
  });

  it("sans clé, aucun entête Authorization ne part", () => {
    const r = construireRequeteCockpit({ acces: "synthese-matinale" }, { COCKPIT_API_BASE: "https://exemple.ansut.ci" });
    expect(r.headers.Authorization).toBeUndefined();
    expect(JSON.parse(r.body)).toEqual({});
  });
});
