/**
 * Edge Function `search-knowledge` — recherche sémantique du corpus SUTA.
 *
 * D'abord un outil de vérification, cette fonction est devenue le CHEMIN DE
 * PRODUCTION de la recherche citoyenne : l'app (Vercel) l'appelle au lieu
 * d'interroger une base par Prisma. Raison vécue au salon : l'intégration
 * Neon de Vercel injectait sa propre DATABASE_URL et SUTA répondait depuis
 * les documents fictifs d'amorçage. Ici, tout vit du même côté que le
 * corpus : même base, même modèle d'embedding (text-embedding-3-small),
 * mêmes filtres — plus rien à aligner côté hébergeur de l'interface.
 *
 * SÉCURITÉ — cette fonction est invocable avec la clé publiable du projet :
 * la visibilité est donc imposée ICI, jamais lue de la requête. Un appelant
 * qui demanderait ["ADMIN"] recevrait du PUBLIC quand même : le client
 * service-role interne obéirait, donc on ne lui transmet pas le choix.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ENDPOINT = "https://dtdi-openai-audio-01.openai.azure.com/";
const DEFAULT_DEPLOYMENT = "text-embedding-3-small";
/** Seuls niveaux servis, quoi que demande l'appelant (MVP Salon). */
const VISIBILITE_IMPOSEE = ["PUBLIC", "DEMO"];
/** Longueur de contenu transmise au modèle vocal : une fiche entière ou presque. */
const CONTENU_MAX = 1600;
const LIMITE_MAX = 8;

interface MatchedChunk {
  chunk_id: string;
  document_title: string;
  section: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  distance: number;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Secret manquant : ${name}.`);
  return value;
}

/**
 * Coordonnées d'un fragment, quand il en porte. Jamais fabriquées : absentes
 * pour un contenu sans dimension géographique (doctrine, synthèses).
 * Cf. packages/knowledge/src/retrieval/extract-location.ts.
 */
function extractLocation(metadata: Record<string, unknown> | null, fallbackLabel: string) {
  if (!metadata) return undefined;
  const { lat, lng, nom } = metadata;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng, label: typeof nom === "string" && nom.length > 0 ? nom : fallbackLabel };
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

    const embedResponse = await fetch(new URL("/openai/v1/embeddings", endpoint), {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: deployment, input: [query.trim().slice(0, 500)] }),
    });
    if (!embedResponse.ok) {
      throw new Error(`Azure embeddings HTTP ${embedResponse.status}`);
    }
    const { data } = await embedResponse.json();
    const vector: number[] = data[0].embedding;

    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: matches, error } = await supabase.rpc("match_chunks", {
      query_embedding: `[${vector.join(",")}]`,
      match_count: matchCount,
      allowed_visibility: VISIBILITE_IMPOSEE,
    });
    if (error) throw new Error(`Recherche : ${error.message}`);

    return Response.json({
      ok: true,
      query,
      results: (matches as MatchedChunk[]).map((match) => ({
        title: match.document_title,
        section: match.section,
        source: match.section ?? "Corpus ANSUT",
        // Score dans [0, 1], 1 = correspondance la plus forte (cf. searchDocuments).
        score: Math.round(Math.max(0, Math.min(1, 1 - match.distance)) * 1000) / 1000,
        location: extractLocation(match.metadata, match.document_title),
        content: match.content.slice(0, CONTENU_MAX),
        // Conservé pour les harnais de vérification qui lisaient `extrait`.
        extrait: match.content.slice(0, 220),
      })),
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
