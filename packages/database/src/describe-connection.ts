/**
 * Chaîne de connexion effective de l'application.
 *
 * `SUTA_DATABASE_URL` prime sur `DATABASE_URL`. La raison est concrète : sur
 * Vercel, une intégration de base de données du marketplace (Neon, ici)
 * injecte son propre `DATABASE_URL` au moment du déploiement, et cette
 * injection l'emporte sur la variable définie manuellement dans le projet.
 * Impossible alors de pointer l'application vers une autre base sans
 * désinstaller l'intégration. Un nom qui n'appartient qu'à ce projet met la
 * configuration hors de portée de ce genre d'écrasement.
 *
 * `DATABASE_URL` reste le comportement par défaut : en local, en CI et
 * partout où aucune intégration n'interfère, rien ne change.
 */
export function resolveDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.SUTA_DATABASE_URL || env.DATABASE_URL || undefined;
}

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
