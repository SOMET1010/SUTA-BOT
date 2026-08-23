import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

/*
 * Monorepo : les fichiers d'environnement (.env.local, .env) vivent à la
 * racine du dépôt, pas dans apps/web. Next.js ne charge automatiquement que
 * les .env de son propre dossier ; on complète ici pour que DATABASE_URL et
 * les autres variables partagées soient disponibles au build comme au
 * runtime, sans dupliquer .env.local dans apps/web.
 */
const repoRoot = resolve(import.meta.dirname, "../..");
for (const filename of [".env.local", ".env"]) {
  const path = resolve(repoRoot, filename);
  if (existsSync(path)) {
    loadEnv({ path });
  }
}

/*
 * Numéro de version visible : le hash court du commit servi, injecté au
 * build. Sur Vercel, VERCEL_GIT_COMMIT_SHA est fourni ; en local on lit git.
 * C'est la preuve « suis-je à jour ? » affichée dans le pied de page.
 */
function resolveBuildVersion(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse HEAD", { cwd: repoRoot }).toString().trim().slice(0, 7);
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUTA_VERSION: resolveBuildVersion(),
  },
};

export default nextConfig;
