/**
 * Edge Function `search-knowledge` — recherche HYBRIDE du corpus SUTA.
 *
 * Chemin de production de la recherche citoyenne (l'app Vercel l'appelle au
 * lieu d'interroger une base par Prisma — voir historique : base Neon
 * injectée, embeddings dépareillés).
 *
 * HYBRIDE — constat de salon : le classement purement vectoriel est trop
 * naïf pour les toponymes (« état du réseau à Korhogo » pouvait faire sortir
 * la fiche Korhogo du top 3 selon la formulation). Le corpus sert de
 * dictionnaire de lieux (match_chunks_geo : un jeton n'est toponyme que s'il
 * existe dans metadata nom/departement/region — aucune liste codée en dur),
 * et la fusion privilégie : 1) les documents trouvés PAR LES DEUX voies
 * (le lieu ET le sujet), 2) les correspondances géographiques exactes,
 * 3) le reste du classement vectoriel. Sans toponyme détecté, la recherche
 * vectorielle est inchangée.
 *
 * SÉCURITÉ — invocable avec la clé publiable : la visibilité est imposée
 * ICI (PUBLIC+DEMO), jamais lue de la requête.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ENDPOINT = "https://dtdi-openai-audio-01.openai.azure.com/";
const DEFAULT_DEPLOYMENT = "text-embedding-3-small";
/** Seuls niveaux servis, quoi que demande l'appelant (MVP Salon). */
const VISIBILITE_IMPOSEE = ["PUBLIC", "DEMO"];
/** Longueur de contenu transmise au modèle vocal : une fiche entière ou presque. */
const CONTENU_MAX = 1600;
const LIMITE_MAX = 8;
/** Profondeur interne des deux voies avant fusion. */
const PROFONDEUR_VECTEUR = 12;
const PROFONDEUR_GEO = 6;

/** Mots outils français : jamais des toponymes, inutile de les vérifier. */
const MOTS_OUTILS = new Set([
  "les", "des", "une", "aux", "est", "sur", "par", "pas", "que", "qui", "quoi",
  "dans", "avec", "pour", "sans", "vers", "chez", "mon", "mes", "ses", "son",
  "leur", "cette", "ces", "quel", "quelle", "quels", "comment", "combien",
  "pourquoi", "quand", "etat", "reseau", "couverture", "internet", "village",
  "localite", "departement", "region", "programme", "formation", "antenne",
  "fibre", "mobile", "telephone", "smartphone", "connecte", "connectee",
]);

interface MatchedChunk {
  chunk_id: string;
  document_title: string;
  section: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  distance: number;
}

interface GeoChunk {
  chunk_id: string;
  document_title: string;
  section: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  geo_rank: number;
  toponyme: string | null;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret manquant : ${name}.`);
  return value;
}

/** Normalisation identique à celle de match_chunks_geo : minuscules, sans
 * accents, traits d'union devenus espaces. */
function normaliser(mot: string): string {
  return mot.normalize("NFD").replace(/\p{M}/gu, "").replace(/-/g, " ").toLowerCase().trim();
}

/** Jetons candidats : mots normalisés + bigrammes (pour « Grand Bassam »
 * écrit sans trait d'union). Le vrai filtre toponymique est fait en base. */
function jetonsCandidats(query: string): string[] {
  const mots = query.split(/[^\p{L}-]+/u).map(normaliser).filter((m) => m.length >= 3 && !MOTS_OUTILS.has(m));
  const bigrammes: string[] = [];
  for (let i = 0; i < mots.length - 1; i += 1) bigrammes.push(`${mots[i]} ${mots[i + 1]}`);
  return [...new Set([...mots, ...bigrammes])];
}

function extractLocation(metadata: Record<string, unknown> | null, fallbackLabel: string) {
  if (!metadata) return undefined;
  const { lat, lng, nom } = metadata;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng, label: typeof nom === "string" && nom.length > 0 ? nom : fallbackLabel };
}

function formater(row: { document_title: string; section: string | null; content: string; metadata: Record<string, unknown> | null }, score: number) {
  return {
    title: row.document_title,
    section: row.section,
    source: row.section ?? "Corpus ANSUT",
    score: Math.round(score * 1000) / 1000,
    location: extractLocation(row.metadata, row.document_title),
    content: row.content.slice(0, CONTENU_MAX),
    extrait: row.content.slice(0, 220),
  };
}

Deno.serve(async (req: Request) => {
  try {
    const { query, limit = 5 } = await req.json();
    if (typeof query !== "string" || query.trim().length === 0) {
      throw new Error('Paramètre "query" requis.');
    }
    const matchCount = Math.min(Math.max(Number(limit) || 5, 1), LIMITE_MAX);

    const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT") || DEFAULT_ENDPOINT;
    const deployment = Deno.env.get("EMBEDDINGS_DEPLOYMENT") || DEFAULT_DEPLOYMENT;
    const apiKey = requireEnv("AZURE_OPENAI_API_KEY");

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Les deux voies partent en parallèle : l'embedding coûte ~100 ms,
    // la correspondance géographique autant — autant les recouvrir.
    const [embedResponse, geoResult] = await Promise.all([
      fetch(new URL("/openai/v1/embeddings", endpoint), {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ model: deployment, input: [query.trim().slice(0, 500)] }),
      }),
      supabase.rpc("match_chunks_geo", {
        tokens: jetonsCandidats(query),
        allowed_visibility: VISIBILITE_IMPOSEE,
        match_count: PROFONDEUR_GEO,
      }),
    ]);

    if (!embedResponse.ok) {
      throw new Error(`Azure embeddings HTTP ${embedResponse.status}`);
    }
    const { data } = await embedResponse.json();
    const vector: number[] = data[0].embedding;

    const { data: matches, error } = await supabase.rpc("match_chunks", {
      query_embedding: `[${vector.join(",")}]`,
      match_count: PROFONDEUR_VECTEUR,
      allowed_visibility: VISIBILITE_IMPOSEE,
    });
    if (error) throw new Error(`Recherche : ${error.message}`);
    if (geoResult.error) throw new Error(`Recherche géo : ${geoResult.error.message}`);

    const vectoriels = (matches as MatchedChunk[]).map((m) => ({
      row: m,
      score: Math.max(0, Math.min(1, 1 - m.distance)),
    }));
    const geo = (geoResult.data ?? []) as GeoChunk[];
    const geoIds = new Set(geo.map((g) => g.chunk_id));

    // Fusion : (1) trouvés par les deux voies — le lieu ET le sujet —,
    // (2) correspondances géographiques exactes restantes (la fiche du
    // village existe même si le vecteur l'a manquée), (3) reste vectoriel.
    const deuxVoies = vectoriels.filter((v) => geoIds.has(v.row.chunk_id));
    const idsRetenus = new Set(deuxVoies.map((v) => v.row.chunk_id));
    const geoSeuls = geo.filter((g) => !idsRetenus.has(g.chunk_id));
    const vecteurSeuls = vectoriels.filter((v) => !geoIds.has(v.row.chunk_id));

    const results = [
      ...deuxVoies.map((v) => formater(v.row, v.score)),
      ...geoSeuls.map((g, i) => formater(g, 0.5 - i * 0.01)),
      ...vecteurSeuls.map((v) => formater(v.row, v.score)),
    ].slice(0, matchCount);

    // Journal temporaire (diagnostic du classement géographique) : jamais de
    // contenu de fiche, uniquement requête, toponymes et titres classés.
    console.log(JSON.stringify({
      query: query.slice(0, 120),
      toponymes: [...new Set(geo.map((g) => g.toponyme).filter(Boolean))],
      geoTrouves: geo.length,
      top5: results.slice(0, 5).map((r) => `${r.title} (${r.score})`),
    }));

    return Response.json({ ok: true, query, results });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
