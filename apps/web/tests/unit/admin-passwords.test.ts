import { afterEach, describe, expect, it } from "vitest";

import { checkAdminPassword } from "@/lib/admin-auth";

/** Deux mots de passe, mêmes droits, révocables séparément (accès équipes). */

const ENV_KEYS = ["ADMIN_PASSWORD", "ADMIN_PASSWORD_EQUIPE"] as const;
const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
afterEach(() => { for (const [k, v] of saved) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } });

describe("checkAdminPassword — mot de passe principal + mot de passe équipes", () => {
  it("sans ADMIN_PASSWORD, tout est refusé — même le mot de passe équipes seul", () => {
    delete process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD_EQUIPE = "equipe-seule";
    expect(checkAdminPassword("equipe-seule")).toBe(false);
  });

  it("accepte le principal, et le mot de passe équipes quand il est posé", () => {
    process.env.ADMIN_PASSWORD = "patrick-secret";
    process.env.ADMIN_PASSWORD_EQUIPE = "equipe-secret";
    expect(checkAdminPassword("patrick-secret")).toBe(true);
    expect(checkAdminPassword("equipe-secret")).toBe(true);
    expect(checkAdminPassword("autre-chose")).toBe(false);
  });

  it("révoquer les équipes ne touche pas le principal", () => {
    process.env.ADMIN_PASSWORD = "patrick-secret";
    delete process.env.ADMIN_PASSWORD_EQUIPE;
    expect(checkAdminPassword("equipe-secret")).toBe(false);
    expect(checkAdminPassword("patrick-secret")).toBe(true);
  });
});
