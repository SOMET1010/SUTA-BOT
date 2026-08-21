/**
 * Edge Function `fetch-document` — récupère un document public en ligne.
 *
 * Une partie de la matière dont SUTA a besoin est publiée sur des sites
 * officiels : plan national de développement, stratégies nationales, textes
 * du régulateur. La session d'assistant qui prépare le corpus n'a pas accès
 * au réseau ouvert ; l'infrastructure Supabase, si.
 *
 * SÉCURITÉ — la liste blanche n'est pas une commodité, c'est la fonction même
 * de ce fichier. Une fonction qui récupère une adresse quelconque depuis notre
 * infrastructure serait un relais : elle permettrait de sonder, avec notre
 * identité et depuis notre réseau, des services tiers ou internes. Les hôtes
 * ci-dessous sont des sources documentaires publiques et institutionnelles,
 * et rien d'autre n'est joignable par cette voie.
 *
 * Le texte est rendu par tranches (`offset`) : un plan de développement fait
 * plusieurs centaines de pages, et une réponse unique serait inexploitable.
 */

import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

/** Sources documentaires publiques autorisées. Un hôte ne s'ajoute ici qu'en
 * connaissance de cause : chaque entrée élargit ce que cette fonction peut
 * atteindre depuis notre infrastructure. */
const HOTES_AUTORISES = [
  "plan.gouv.ci",
  "www.plan.gouv.ci",
  "artci.ci",
  "www.artci.ci",
  "renovation.artci.ci",
  "telecom.gouv.ci",
  "www.telecom.gouv.ci",
  "gouv.ci",
  "www.gouv.ci",
  "documents.worldbank.org",
  "documents1.worldbank.org",
  "www.itu.int",
];

/** Au-delà, on ne récupère pas : ce n'est plus un document, c'est un transfert. */
const TAILLE_MAX_OCTETS = 60 * 1024 * 1024;
/** Taille d'une tranche de texte rendue par appel. */
const TRANCHE_CARACTERES = 90_000;

/** Rend le texte d'une page HTML, sans le balisage ni les scripts. */
function texteDepuisHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, c: string) => String.fromCodePoint(Number(c)))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

  try {
    const options = await req.json().catch(() => ({}));
    const cible: string = options.url ?? "";
    const offset: number = Number(options.offset ?? 0);

    let url: URL;
    try {
      url = new URL(cible);
    } catch {
      throw new Error("Adresse illisible.");
    }
    if (url.protocol !== "https:") {
      throw new Error("Seul HTTPS est accepté.");
    }
    if (!HOTES_AUTORISES.includes(url.hostname)) {
      throw new Error(
        `Hôte refusé : ${url.hostname}. Sources autorisées : ${HOTES_AUTORISES.join(", ")}.`,
      );
    }

    const response = await fetch(url, {
      headers: { "User-Agent": "SUTA-corpus/1.0 (ANSUT)", Accept: "*/*" },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Lecture HTTP ${response.status} sur ${url.hostname}.`);
    }

    // La redirection a pu sortir de la liste blanche : on revérifie l'adresse
    // réellement servie, pas seulement celle demandée.
    const finale = new URL(response.url);
    if (!HOTES_AUTORISES.includes(finale.hostname)) {
      throw new Error(`Redirection hors liste blanche : ${finale.hostname}.`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > TAILLE_MAX_OCTETS) {
      throw new Error(`Document trop volumineux : ${buffer.byteLength} octets.`);
    }

    const typeContenu = response.headers.get("content-type") ?? "";
    let texte: string;
    let pages: number | null = null;

    if (typeContenu.includes("pdf") || url.pathname.toLowerCase().endsWith(".pdf")) {
      const document = await getDocumentProxy(new Uint8Array(buffer));
      const extrait = await extractText(document, { mergePages: true });
      texte = String(extrait.text ?? "");
      pages = extrait.totalPages ?? null;
    } else {
      texte = texteDepuisHtml(new TextDecoder().decode(buffer));
    }

    const tranche = texte.slice(offset, offset + TRANCHE_CARACTERES);

    return Response.json({
      ok: true,
      url: response.url,
      contentType: typeContenu,
      octets: buffer.byteLength,
      pages,
      caracteres: texte.length,
      offset,
      // `null` quand il ne reste rien : le signal d'arrêt de la boucle.
      offsetSuivant: offset + tranche.length < texte.length ? offset + tranche.length : null,
      texte: tranche,
      elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
      },
      { status: 500 },
    );
  }
});
