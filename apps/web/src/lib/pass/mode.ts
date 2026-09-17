/**
 * SUTA PASS — la bascule d'instance, étendue à trois voies.
 *
 * `46bd95c` avait introduit deux instances sur une seule base de code :
 * citoyenne par défaut, Cockpit quand `SUTA_MODE=cockpit`. PASS est la
 * troisième. Le principe ne change pas — le choix se fait PAR DÉPLOIEMENT,
 * jamais par requête, et il n'existe aucun pont entre les instances.
 *
 * ── POURQUOI CE MODULE ÉCHOUE FERMÉ ─────────────────────────────────────
 *
 * Une valeur inattendue de `SUTA_MODE` ne retombe PAS sur l'instance
 * citoyenne. Un `SUTA_MODE=pas` mal tapé sur un déploiement destiné au
 * téléphone servirait sinon l'assistant citoyen — avec ses outils, sa base de
 * connaissances et son prompt — à une personne qui attend son répertoire.
 * Le mode inconnu ne satisfait donc AUCUNE garde : toutes les routes d'outils
 * répondent 404 et la session refuse de s'ouvrir. La panne est bruyante et
 * immédiate, ce qui est exactement ce qu'on veut d'une erreur de déploiement.
 */

export type ModeSuta = "citoyen" | "cockpit" | "pass";

/** Le mode d'une instance, ou `"inconnu"` si `SUTA_MODE` porte autre chose. */
export type ModeResolu = ModeSuta | "inconnu";

type Env = Record<string, string | undefined>;

const MODES_EXPLICITES: Record<string, ModeSuta> = {
  cockpit: "cockpit",
  pass: "pass",
  citoyen: "citoyen",
};

/**
 * Quelle instance sert cette requête ?
 *
 * Variable absente ou vide = `citoyen`, strictement comme avant l'arrivée de
 * Cockpit puis de PASS. C'est la garantie de non-régression du déploiement
 * citoyen existant.
 */
export function modeSuta(env: Env): ModeResolu {
  const brut = env.SUTA_MODE?.trim().toLowerCase();
  if (!brut) return "citoyen";
  return MODES_EXPLICITES[brut] ?? "inconnu";
}

/** L'instance sert-elle le téléphone ? */
export function modePassActif(env: Env): boolean {
  return modeSuta(env) === "pass";
}

/** Réponse d'une route qui n'existe pas sur cette instance. */
export function reponseInexistante(): Response {
  return Response.json({ error: "Point d'accès inexistant sur cette instance." }, { status: 404 });
}

/**
 * Garde d'instance à poser en tête d'une route d'outil : rend une 404 quand
 * l'instance courante n'est pas celle attendue, `null` quand la route peut
 * s'exécuter.
 *
 * Posée sur les outils citoyens autant que sur PASS : l'isolation ne vaut que
 * si elle est réciproque. Un déploiement PASS ne doit pas pouvoir atteindre la
 * base de connaissances citoyenne, même par une requête directe.
 */
export function gardeInstance(env: Env, requis: ModeSuta): Response | null {
  return modeSuta(env) === requis ? null : reponseInexistante();
}
