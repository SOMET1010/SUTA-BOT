import {
  accesDuPilote,
  cockpitConfigure,
  construireRequeteCockpit,
  formulerALaVoix,
  modeCockpitActif,
  reponseSimulee,
  validerEnveloppe,
  type EnveloppeCockpit,
} from "@/lib/cockpit/contrat";

/**
 * Outil `cockpit_interroger` côté serveur — instance SUTA Cockpit
 * uniquement. Sur l'instance citoyenne (SUTA_MODE absent), cette route
 * répond 404 : zéro pont, l'assistant citoyen ne peut pas atteindre les
 * données de pilotage même par accident.
 *
 * La formulation vocale est produite ICI (formulerALaVoix) : une enveloppe
 * non conforme au contrat (sans date, sans périmètre…) n'est jamais énoncée
 * — SUTA explique pourquoi au lieu de dire un chiffre douteux.
 */
const COCKPIT_TIMEOUT_MS = 9_000;

export async function POST(request: Request) {
  const env = process.env as Record<string, string | undefined>;
  if (!modeCockpitActif(env)) {
    return Response.json({ error: "Point d'accès inexistant sur cette instance." }, { status: 404 });
  }
  if (!cockpitConfigure(env)) {
    return Response.json(
      {
        error:
          "L'instance Cockpit n'est pas encore branchée : renseignez COCKPIT_API_BASE " +
          "(l'URL de base des points d'accès Cockpit, ou « simulation » pour le jeu de " +
          "test intégré) et COCKPIT_API_KEY.",
      },
      { status: 503 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = body && typeof body === "object" ? (body as { acces?: unknown; indicateur?: unknown }) : {};
  const acces = accesDuPilote(parsed.acces);
  if (!acces) {
    return Response.json(
      { error: "Accès inconnu ou hors pilote (disponibles : indicateur, alertes-du-jour, synthese-matinale)." },
      { status: 400 },
    );
  }
  const indicateur = typeof parsed.indicateur === "string" && parsed.indicateur.trim() ? parsed.indicateur.trim() : undefined;
  if (acces === "indicateur" && !indicateur) {
    return Response.json({ error: "L'accès indicateur demande l'identifiant de l'indicateur." }, { status: 400 });
  }

  let brut: unknown;
  if (env.COCKPIT_API_BASE?.trim().toLowerCase() === "simulation") {
    brut = reponseSimulee(acces, indicateur);
  } else {
    const requete = construireRequeteCockpit({ acces, indicateur }, env);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COCKPIT_TIMEOUT_MS);
    try {
      const reponse = await fetch(requete.url, {
        method: "POST",
        headers: requete.headers,
        body: requete.body,
        signal: controller.signal,
      });
      if (!reponse.ok) {
        console.error("[api/tools/cockpit] refus de Cockpit", acces, reponse.status);
        return Response.json(
          { error: `Cockpit n'a pas répondu à cette demande (HTTP ${reponse.status}).` },
          { status: 502 },
        );
      }
      brut = await reponse.json().catch(() => null);
    } catch {
      return Response.json({ error: "Cockpit est momentanément injoignable." }, { status: 503 });
    } finally {
      clearTimeout(timer);
    }
  }

  const verdict = validerEnveloppe(brut);
  if (!verdict.ok) {
    console.error("[api/tools/cockpit] enveloppe non conforme", acces, verdict.motif);
    return Response.json(
      { error: `La réponse de Cockpit ne respecte pas le contrat (${verdict.motif}) : je préfère ne pas énoncer ce chiffre.` },
      { status: 502 },
    );
  }

  const enveloppe: EnveloppeCockpit = verdict.enveloppe;
  return Response.json({
    ok: true,
    a_dire: formulerALaVoix(enveloppe),
    publiable: enveloppe.publiable,
    date_donnees: enveloppe.date_donnees ?? null,
    perimetre: enveloppe.perimetre ?? null,
    source: enveloppe.source ?? null,
    ecran: enveloppe.ecran ?? null,
  });
}
