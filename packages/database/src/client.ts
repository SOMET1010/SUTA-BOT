import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/client.ts";
import { resolveDatabaseUrl } from "./describe-connection.ts";

declare global {
  // eslint-disable-next-line no-var
  var __sutaPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "SUTA_DATABASE_URL ou DATABASE_URL est requis pour se connecter à la " +
        "base de données SUTA (voir .env.example).",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

let lazyClient: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  const existing = globalThis.__sutaPrisma ?? lazyClient;
  if (existing) return existing;

  lazyClient = createPrismaClient();
  // Mise en cache sur `globalThis` en dehors de la production pour éviter
  // d'épuiser les connexions lors du rechargement à chaud (Next.js dev).
  if (process.env.NODE_ENV !== "production") {
    globalThis.__sutaPrisma = lazyClient;
  }
  return lazyClient;
}

/**
 * Instance partagée du client Prisma, créée à la première utilisation réelle.
 *
 * L'initialisation était auparavant faite au chargement du module, ce qui
 * ouvrait un pool de connexions dès qu'un module importait `@suta/database`,
 * même sans jamais interroger la base. La route de création de session
 * Realtime en est le cas typique : elle n'a besoin que des définitions
 * d'outils, mais la chaîne d'imports `@suta/tools` → `@suta/knowledge` →
 * `@suta/database` lui faisait payer l'ouverture du pool à chaque démarrage
 * à froid, en pure perte.
 *
 * Effet de bord bienvenu : `DATABASE_URL` n'est plus exigé au simple import,
 * donc la collecte des pages au build Next.js ne peut plus échouer sur une
 * route qui ne touche pas la base.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    // Les scripts appellent `$disconnect()` dans un `finally` : le déclencher
    // alors qu'aucune connexion n'a été ouverte créerait un client pour rien,
    // et masquerait l'erreur d'origine si `DATABASE_URL` est absent.
    if (property === "$disconnect" && !globalThis.__sutaPrisma && !lazyClient) {
      return async () => {};
    }
    const client = getPrismaClient();
    const value = Reflect.get(client, property) as unknown;
    // Les méthodes doivent rester liées au client réel, pas au proxy vide.
    return typeof value === "function" ? value.bind(client) : value;
  },
});
