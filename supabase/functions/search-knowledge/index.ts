/**
 * Edge Function `search-knowledge` — recherche sémantique de vérification.
 *
 * Rejoue la chaîne de recherche de l'app (`searchDocuments` →
 * `findSimilarChunks`) directement sur la base Supabase : même modèle
 * d'embedding, mêmes filtres, même distance cosinus. Sert à valider un corpus
 * fraîchement indexé sans avoir à lancer l'application.
 *
 * Ce n'est pas un chemin de production : l'app interroge la base via Prisma.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_ENDPOINT = "https://dtdi-openai-audio-01.openai.azure.com/";
const DEFAULT_DEPLOYMENT = "text-embedding-3-small";
/** Niveaux ouverts au public (MVP Salon) — cf. packages/tools/src/search-knowledge.ts. */
const DEFAULT_VISIBILITY = ["PUBLIC", "DEMO"];

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
    const { query, limit = 5, visibility = DEFAULT_VISIBILITY } = await req.json();
    if (typeof query !== "string" || query.trim().length === 0) {
      throw new Error('Paramètre "query" requis.');
    }

    const endpoint = Deno.env.get("AZURE_OPENAI_ENDPOINT") || DEFAULT_ENDPOINT;
    const deployment = Deno.env.get("EMBEDDINGS_DEPLOYMENT") || DEFAULT_DEPLOYMENT;
    const apiKey = requireEnv("AZURE_OPENAI_API_KEY");

    const embedResponse = await fetch(new URL("/openai/v1/embeddings", endpoint), {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ model: deployment, input: [query.trim()] }),
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
      match_count: limit,
      allowed_visibility: visibility,
    });
    if (error) throw new Error(`Recherche : ${error.message}`);

    return Response.json({
      ok: true,
      query,
      results: (matches as MatchedChunk[]).map((match) => ({
        title: match.document_title,
        section: match.section,
        // Score dans [0, 1], 1 = correspondance la plus forte (cf. searchDocuments).
        score: Math.round(Math.max(0, Math.min(1, 1 - match.distance)) * 1000) / 1000,
        location: extractLocation(match.metadata, match.document_title),
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
