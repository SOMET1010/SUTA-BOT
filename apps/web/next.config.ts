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

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
