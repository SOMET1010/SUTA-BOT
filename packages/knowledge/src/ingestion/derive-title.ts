/**
 * Déduit un titre lisible depuis le premier titre Markdown de premier
 * niveau (`# ...`) du document nettoyé, plutôt que d'exposer le nom de
 * fichier brut dans l'interface (panneau des sources, section 38).
 * Retourne `undefined` si aucun titre de premier niveau n'est trouvé — le
 * nom de fichier reste alors le repli (voir `ingest.ts`).
 *
 * Module séparé et sans dépendance (notamment `@suta/database`) pour rester
 * testable isolément : `ingest.ts` importe `@suta/database`, qui crée son
 * client Prisma dès le chargement du module et échoue sans `DATABASE_URL`.
 */
export function deriveTitle(cleaned: string): string | undefined {
  const heading = cleaned.split("\n").find((line) => /^#\s+\S/.test(line));
  return heading?.replace(/^#\s+/, "").trim();
}
