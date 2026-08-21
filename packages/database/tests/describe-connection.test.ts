import { describe, expect, it } from "vitest";
import { describeDatabaseHost, resolveDatabaseUrl } from "../src/describe-connection";

describe("resolveDatabaseUrl", () => {
  it("falls back to DATABASE_URL when no override is set", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: "postgresql://a/b" })).toBe("postgresql://a/b");
  });

  it("lets SUTA_DATABASE_URL win over an injected DATABASE_URL", () => {
    // Cas réel : l'intégration Neon de Vercel injecte son propre
    // DATABASE_URL au déploiement, écrasant celui du projet.
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgresql://injecte-par-integration/neon",
        SUTA_DATABASE_URL: "postgresql://choisi-par-le-projet/supabase",
      }),
    ).toBe("postgresql://choisi-par-le-projet/supabase");
  });

  it("ignores an empty override rather than blocking the fallback", () => {
    expect(
      resolveDatabaseUrl({ SUTA_DATABASE_URL: "", DATABASE_URL: "postgresql://a/b" }),
    ).toBe("postgresql://a/b");
  });

  it("returns undefined when neither is set", () => {
    expect(resolveDatabaseUrl({})).toBeUndefined();
  });
});

describe("describeDatabaseHost", () => {
  it("returns host and port for a pooled Supabase connection string", () => {
    expect(
      describeDatabaseHost(
        "postgresql://postgres.abc:s3cr3t@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true",
      ),
    ).toBe("aws-1-eu-west-3.pooler.supabase.com:6543");
  });

  it("never exposes the user or the password", () => {
    const described = describeDatabaseHost(
      "postgresql://neondb_owner:npg_TopSecret@ep-cool-1.eu-central-1.aws.neon.tech/neondb",
    );
    expect(described).not.toContain("npg_TopSecret");
    expect(described).not.toContain("neondb_owner");
    expect(described).toBe("ep-cool-1.eu-central-1.aws.neon.tech");
  });

  it("reports a missing configuration rather than throwing", () => {
    expect(describeDatabaseHost(undefined)).toBe("non configurée");
    expect(describeDatabaseHost("")).toBe("non configurée");
  });

  it("reports an unreadable address rather than throwing", () => {
    // Cas réel : une valeur collée de travers (Vercel masque la valeur, donc
    // l'erreur ne se voit qu'ici).
    expect(describeDatabaseHost("ceci n'est pas une URL")).toBe("adresse illisible");
  });
});
