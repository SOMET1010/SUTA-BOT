import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.ts";

declare global {
  // eslint-disable-next-line no-var
  var __sutaPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL est requis pour se connecter à la base de données SUTA " +
        "(voir .env.example).",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

/**
 * Instance partagée du client Prisma. Mise en cache sur `globalThis` en
 * dehors de la production pour éviter d'épuiser les connexions lors du
 * rechargement à chaud (Next.js dev).
 */
export const prisma: PrismaClient = globalThis.__sutaPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__sutaPrisma = prisma;
}
