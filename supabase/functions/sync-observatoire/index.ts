/**
 * Edge Function `sync-observatoire` — reprise des données de l'observatoire.
 *
 * L'observatoire ANSUT (projet `ansut-connect`) tient les données vivantes :
 * sites déployés, scoring des villages, couverture, zones blanches. Le corpus
 * initialement ingéré dans SUTA n'en gardait qu'une fraction — ni les écoles,
 * ni les centres de santé, ni le satellite, ni le détail des critères de
 * priorisation.
 *
 * Cette fonction va les chercher à la source, par l'API REST publique de
 * l'observatoire (lecture ouverte par ses propres politiques RLS), et les
 * réécrit en fiches auto-descriptives dans la base de SUTA. Elle tourne chez
 * Supabase, qui a l'accès réseau ; les données ne transitent par aucun poste.
 *
 * Idempotente : les identifiants dérivent de ceux de l'observatoire, donc une
 * resynchronisation met à jour sans dupliquer. Relancer la fonction est le
 * geste qui met SUTA à jour quand l'observatoire évolue.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

/** Projet Supabase de l'observatoire. Ni l'URL ni la clé anonyme ne sont des
 * secrets : elles figurent dans le paquet JavaScript de son site public. */
const DEFAULT_OBSERVATOIRE_URL = "https://kjlxarjcrhzmqcqyhuju.supabase.co";
const DEFAULT_OBSERVATOIRE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqbHhhcmpjcmh6bXFjcXlodWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDg4OTQsImV4cCI6MjA4NjQyNDg5NH0.84nOLEcW_HNCPDFVMtRa_GVq-472UIOLeMG05hxn68I";

const PAGE_SIZE = 500;
const UPSERT_BATCH = 250;
const DEFAULT_MAX_SECONDS = 120;

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variable manquante : ${name}.`);
  return value;
}

/** Écrit un nombre en français, ou rend `null` si la valeur est absente. */
function num(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed.toLocaleString("fr-FR");
}

/** Assemble des bouts de phrase en ignorant ceux qui n'ont pas de valeur. */
function sentence(parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}

function metres(value: unknown): string | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed >= 1000
    ? `${(parsed / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`
    : `${Math.round(parsed)} m`;
}

interface CorpusEntry {
  id: string;
  source: string;
  type: string;
  title: string;
  region: string | null;
  departement: string | null;
  content: string;
  metadata: Record<string, unknown>;
  /** Visibilité souhaitée ; l'ingestion force de toute façon ADMIN pour le scoring. */
  visibility?: "PUBLIC" | "ADMIN";
}

/** Un site déployé ou programmé : école, centre, abri, satellite, BTS, fibre… */
function siteToEntry(row: Record<string, unknown>): CorpusEntry {
  const type = String(row.type ?? "Site");
  const nom = String(row.nom ?? "site sans nom");
  const lieu = sentence([
    row.sous_prefecture ? `sous-préfecture de ${row.sous_prefecture},` : null,
    row.departement ? `département de ${row.departement},` : null,
    row.region ? `région ${row.region}` : null,
  ]);

  const content = sentence([
    `${type} « ${nom} »${lieu ? `, ${lieu}` : ""}.`,
    row.statut ? `Statut : ${row.statut}.` : null,
    row.operateur ? `Opérateur : ${row.operateur}.` : null,
    row.variante_satellite ? `Solution satellitaire : ${row.variante_satellite}.` : null,
    row.operateur_satellite ? `Opérateur satellite : ${row.operateur_satellite}.` : null,
    num(row.population_couverte) ? `Population couverte : ${num(row.population_couverte)}.` : null,
    row.financement ? `Financement : ${row.financement}.` : null,
    row.phase ? `Phase : ${row.phase}.` : null,
    row.date_mise_service ? `Mise en service : ${row.date_mise_service}.` : null,
    row.acces_technologie ? `Technologie d'accès : ${row.acces_technologie}.` : null,
    row.acces_debit ? `Débit : ${row.acces_debit}.` : null,
    num(row.usage_beneficiaires) ? `Bénéficiaires : ${num(row.usage_beneficiaires)}.` : null,
    row.commentaires ? `Observation : ${row.commentaires}` : null,
  ]);

  return {
    id: `site-${row.id}`,
    source: "sites_deployes",
    type: "site",
    title: `${type} — ${nom}`,
    region: (row.region as string) ?? null,
    departement: (row.departement as string) ?? null,
    content,
    metadata: {
      nom,
      typeSite: type,
      statut: row.statut ?? null,
      operateur: row.operateur ?? null,
      lat: row.latitude,
      lng: row.longitude,
      populationCouverte: row.population_couverte ?? null,
      financement: row.financement ?? null,
    },
  };
}

/** Un village scoré, avec le détail que le corpus initial ne portait pas. */
function villageToEntry(row: Record<string, unknown>): CorpusEntry {
  const nom = String(row.nom ?? "village sans nom");
  const retenu = row.retenu === true;
  const rang = Number(row.rang);
  const score = Number(row.score_total);

  const equipements = sentence([
    Number(row.nb_ecoles) > 0 ? `${num(row.nb_ecoles)} école(s)` : null,
    Number(row.nb_centres_sante) > 0 ? `${num(row.nb_centres_sante)} centre(s) de santé` : null,
  ]);

  const content = sentence([
    `Village de ${nom},`,
    sentence([
      row.sous_prefecture ? `sous-préfecture de ${row.sous_prefecture},` : null,
      row.departement ? `département de ${row.departement},` : null,
      row.region ? `région ${row.region}.` : null,
    ]),
    num(row.population) ? `Population : ${num(row.population)} habitants.` : null,
    equipements ? `Équipements présents : ${equipements}.` : "Aucune école ni centre de santé recensé.",
    row.electrifie ? `Électrification : ${row.electrifie}.` : null,
    // La priorisation est le point sur lequel une réponse fausse serait la
    // plus dommageable : elle est donc énoncée sans ambiguïté.
    retenu
      ? `Ce village est RETENU dans la vague de financement du service universel, au rang national ${rang}, avec un score AIGF de ${score.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} sur 100.`
      : `Ce village n'est PAS retenu dans la vague de financement actuelle (score AIGF de ${score.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} sur 100, non classé au rang national).`,
    row.eligible === false
      ? "Il n'est pas éligible, généralement parce qu'une couverture 3G y existe déjà."
      : null,
    `Détail des critères — population ${num(row.score_population)}, électrification ${num(row.score_electrification)}, éducation ${num(row.score_education)}, santé ${num(row.score_sante)}, route ${num(row.score_route)}, fibre optique ${num(row.score_fo)}, faisceau hertzien ${num(row.score_fh)}, frontière ${num(row.score_frontiere)}, région prioritaire ${num(row.score_region_prioritaire)}.`,
    sentence([
      "Distances :",
      metres(row.dist_route_m) ? `route praticable ${metres(row.dist_route_m)},` : null,
      metres(row.dist_fo_m) ? `raccordement fibre ${metres(row.dist_fo_m)},` : null,
      metres(row.dist_fh_m) ? `relais hertzien ${metres(row.dist_fh_m)},` : null,
      metres(row.dist_site_3g_m) ? `site 3G le plus proche ${metres(row.dist_site_3g_m)}.` : null,
    ]),
  ]);

  return {
    id: `scoring-${row.id}`,
    source: "scoring_villages",
    type: "village_score",
    title: `Scoring AIGF — ${nom}${retenu ? ` (rang ${rang})` : " (non retenu)"}`,
    region: (row.region as string) ?? null,
    departement: (row.departement as string) ?? null,
    content,
    metadata: {
      nom,
      lat: row.latitude,
      lng: row.longitude,
      population: row.population ?? null,
      score_total: row.score_total ?? null,
      rang: Number.isFinite(rang) ? rang : null,
      retenu,
      eligible: row.eligible === true,
      nb_ecoles: row.nb_ecoles ?? 0,
      nb_centres_sante: row.nb_centres_sante ?? 0,
      electrifie: row.electrifie ?? null,
    },
  };
}

/**
 * Fiche jumelle CITOYENNE d'un village scoré — incident de salon : la fiche
 * de scoring mêlait faits citoyens et décision de sélection, et une fois le
 * scoring basculé ADMIN, un village comme DJACE n'avait plus AUCUNE fiche
 * publique. Celle-ci ne porte que ce qu'un citoyen a le droit d'entendre :
 * localisation, population, équipements, électrification, distances aux
 * infrastructures. Jamais de retenu/score/rang/vague/éligibilité.
 */
function villageToCitizenEntry(row: Record<string, unknown>): CorpusEntry {
  const nom = String(row.nom ?? "village sans nom");

  const equipements = sentence([
    Number(row.nb_ecoles) > 0 ? `${num(row.nb_ecoles)} école(s)` : null,
    Number(row.nb_centres_sante) > 0 ? `${num(row.nb_centres_sante)} centre(s) de santé` : null,
  ]);

  const content = sentence([
    `Village de ${nom},`,
    sentence([
      row.sous_prefecture ? `sous-préfecture de ${row.sous_prefecture},` : null,
      row.departement ? `département de ${row.departement},` : null,
      row.region ? `région ${row.region}.` : null,
    ]),
    num(row.population) ? `Population : ${num(row.population)} habitants.` : null,
    equipements ? `Équipements présents : ${equipements}.` : "Aucune école ni centre de santé recensé.",
    row.electrifie ? `Électrification : ${row.electrifie}.` : null,
    sentence([
      "Distances aux infrastructures :",
      metres(row.dist_route_m) ? `route praticable ${metres(row.dist_route_m)},` : null,
      metres(row.dist_fo_m) ? `raccordement fibre ${metres(row.dist_fo_m)},` : null,
      metres(row.dist_fh_m) ? `relais hertzien ${metres(row.dist_fh_m)},` : null,
      metres(row.dist_site_3g_m) ? `site 3G le plus proche ${metres(row.dist_site_3g_m)}.` : null,
    ]),
  ]);

  return {
    id: `localite-${row.id}`,
    source: "scoring_villages",
    type: "village_infos",
    title: `Localité — ${nom}${row.departement ? ` (${row.departement})` : ""}`,
    region: (row.region as string) ?? null,
    departement: (row.departement as string) ?? null,
    content,
    visibility: "PUBLIC",
    metadata: {
      nom,
      lat: row.latitude,
      lng: row.longitude,
      population: row.population ?? null,
      nb_ecoles: row.nb_ecoles ?? 0,
      nb_centres_sante: row.nb_centres_sante ?? 0,
      electrifie: row.electrifie ?? null,
    },
  };
}

const TABLES = {
  localites: { select: "*", toEntries: (row: Record<string, unknown>) => [siteToEntry(row)] },
  // Chaque village produit deux fiches : la fiche de scoring (décision —
  // née ADMIN par la règle d'ingestion) et sa jumelle citoyenne (PUBLIC).
  scoring_villages: { select: "*", toEntries: (row: Record<string, unknown>) => [villageToEntry(row), villageToCitizenEntry(row)] },
} as const;

type TableName = keyof typeof TABLES;

Deno.serve(async (req: Request) => {
  const startedAt = Date.now();

  try {
    const options = await req.json().catch(() => ({}));
    const table: TableName = options.table ?? "localites";
    const maxSeconds: number = options.maxSeconds ?? DEFAULT_MAX_SECONDS;
    let offset: number = options.offset ?? 0;

    if (!(table in TABLES)) {
      throw new Error(`Table inconnue : ${table}. Attendu : ${Object.keys(TABLES).join(", ")}.`);
    }
    const { select, toEntries } = TABLES[table];

    const observatoireUrl =
      Deno.env.get("OBSERVATOIRE_URL") || DEFAULT_OBSERVATOIRE_URL;
    const observatoireKey =
      Deno.env.get("OBSERVATOIRE_ANON_KEY") || DEFAULT_OBSERVATOIRE_KEY;

    const suta = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    let written = 0;
    let done = false;

    while ((Date.now() - startedAt) / 1000 < maxSeconds) {
      const url = new URL(`/rest/v1/${table}`, observatoireUrl);
      url.searchParams.set("select", select);
      url.searchParams.set("order", "id");
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(offset));

      const response = await fetch(url, {
        headers: { apikey: observatoireKey, Authorization: `Bearer ${observatoireKey}` },
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Lecture observatoire (${table}) HTTP ${response.status} : ${detail.slice(0, 300)}`);
      }

      const rows = (await response.json()) as Record<string, unknown>[];
      if (rows.length === 0) {
        done = true;
        break;
      }

      const entries = rows.flatMap(toEntries);
      for (let index = 0; index < entries.length; index += UPSERT_BATCH) {
        const batch = entries.slice(index, index + UPSERT_BATCH);
        const { error } = await suta.rpc("upsert_corpus_entries", { payload: batch });
        if (error) throw new Error(`Écriture (offset ${offset}) : ${error.message}`);
      }

      written += rows.length;
      offset += rows.length;
      if (rows.length < PAGE_SIZE) {
        done = true;
        break;
      }
    }

    return Response.json({
      ok: true,
      table,
      written,
      nextOffset: done ? null : offset,
      done,
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
