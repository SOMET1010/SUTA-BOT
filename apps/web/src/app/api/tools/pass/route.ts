import { validerAction } from "@suta/pass";
import { gardeInstance } from "@/lib/pass/mode";

/**
 * Validation des actions PASS — instance PASS uniquement. Sur toute autre
 * instance (citoyenne, Cockpit, ou mode inconnu), cette route répond 404 :
 * zéro pont, l'assistant citoyen ne peut pas atteindre le téléphone de
 * quelqu'un même par accident.
 *
 * ── CE QUE CETTE ROUTE NE FAIT PAS ──────────────────────────────────────
 *
 * Elle N'EXÉCUTE RIEN. Le serveur ne pilote jamais un téléphone : il n'en a ni
 * le moyen, ni le droit. Son seul rôle est de valider l'action nommée par le
 * moteur Realtime et de rendre sa forme normalisée, que l'application remettra
 * à son pont natif.
 *
 * C'est aussi pourquoi le chemin HORS LIGNE ne passe pas par ici : il appelle
 * `resoudreAction` directement dans la WebView, avec le même code et les mêmes
 * schémas. Cette route est le chemin en ligne du MÊME contrat, pas un second
 * contrat.
 */
export async function POST(request: Request) {
  const refus = gardeInstance(process.env as Record<string, string | undefined>, "pass");
  if (refus) return refus;

  const body: unknown = await request.json().catch(() => null);
  const enveloppe = body && typeof body === "object" ? (body as { action?: unknown; entree?: unknown }) : {};

  const validation = validerAction(enveloppe.action, enveloppe.entree);
  if (!validation.ok) {
    return Response.json({ error: validation.erreur }, { status: 400 });
  }
  return Response.json({ ok: true, action: validation.action });
}
