/**
 * Extrait le serveur d'une chaîne de connexion PostgreSQL, sans jamais
 * exposer l'utilisateur ni le mot de passe.
 *
 * Sert à répondre d'un coup d'œil à « sur quelle base l'application est-elle
 * réellement branchée ? ». La question n'est pas théorique : Vercel masque la
 * valeur des variables marquées « Sensitive » (`vercel env pull` écrit
 * `[SENSITIVE]`), donc l'adresse configurée n'est pas relisible depuis
 * l'extérieur — seule l'application peut la constater.
 *
 * Module sans dépendance, séparé de `client.ts` (qui exige `DATABASE_URL`),
 * pour rester testable isolément.
 */
export function describeDatabaseHost(connectionString: string | undefined): string {
  if (!connectionString) return "non configurée";
  try {
    const url = new URL(connectionString);
    if (!url.hostname) return "adresse illisible";
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return "adresse illisible";
  }
}
