/**
 * Edge Function `load-fiches` — charge un lot de fiches versionné dans le dépôt.
 *
 * Les fiches rédigées à partir d'une source volumineuse — une base métier de
 * plusieurs milliers de lignes, un rapport de deux cents pages — se comptent
 * par centaines. Les faire transiter par une session d'assistant coûte cher et
 * les expose à une recopie fautive.
 *
 * Cette fonction les prend là où elles doivent être : dans le dépôt, sous
 * `supabase/fiches/`, versionnées, relisibles, comparables d'une version à
 * l'autre. Elle les lit par HTTP depuis GitHub et les écrit via
 * `upsert_document_fiches`, qui décide de la visibilité fiche par fiche.
 *
 * Conséquence à connaître : seules les fiches **communicables** peuvent passer
 * par ici, puisque le dépôt est public. Les fiches internes se chargent
 * autrement (voir `supabase/README.md`).
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

/** Le seul hôte accepté. La fonction est invocable avec la clé anonyme : sans
 * cette restriction, elle deviendrait un relais permettant de lui faire
 * chercher n'importe quelle adresse depuis l'infrastructure Supabase. */
const PREFIXE_AUTORISE = "https://raw.githubusercontent.com/SOMET1010/SUTA-BOT/";

const LOT = 40;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variable manquante : ${name}.`);
  return value;
}

interface Fiche {
  id: string;
  title: string;
  content: string;
  visibility?: string;
  region?: string | null;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

  try {
    const options = await req.json().catch(() => ({}));
    const url: string = options.url ?? "";
    const sourceId: string = options.sourceId ?? "";
    const sourceName: string = options.sourceName ?? sourceId;
    const sourceDescription: string = options.sourceDescription ?? "";

    if (!url.startsWith(PREFIXE_AUTORISE)) {
      throw new Error(`Adresse refusée : seules celles commençant par ${PREFIXE_AUTORISE} sont acceptées.`);
    }
    if (!sourceId) throw new Error("sourceId est obligatoire.");

    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Lecture du lot HTTP ${response.status} : ${url}`);
    }

    const fiches = (await response.json()) as Fiche[];
    if (!Array.isArray(fiches)) throw new Error("Le lot doit être un tableau JSON de fiches.");

    // Une fiche sans contenu produirait un fragment vide, donc un vecteur qui
    // ne veut rien dire et qui remonterait au hasard dans les recherches.
    const invalides = fiches.filter((f) => !f?.id || !f?.title || !f?.content);
    if (invalides.length > 0) {
      throw new Error(`${invalides.length} fiche(s) sans id, titre ou contenu.`);
    }

    const suta = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    let chargees = 0;
    for (let index = 0; index < fiches.length; index += LOT) {
      const batch = fiches.slice(index, index + LOT);
      const { error } = await suta.rpc("upsert_document_fiches", {
        source_id: sourceId,
        source_name: sourceName,
        source_description: sourceDescription,
        payload: batch,
      });
      if (error) throw new Error(`Écriture (fiche ${index}) : ${error.message}`);
      chargees += batch.length;
    }

    return Response.json({
      ok: true,
      source: sourceId,
      chargees,
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
