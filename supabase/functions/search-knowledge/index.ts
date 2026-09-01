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
/** Profondeur interne des deux voies avant fusion. Assez profond pour que
 * les fiches de sujet subsistent même quand des fiches de villages au nom
 * proche occupent les premiers rangs vectoriels. */
const PROFONDEUR_VECTEUR = 16;
const PROFONDEUR_GEO = 6;
/** Vague 1 de l'analyse Diakité (01/09) : le plancher de pertinence vaut
 * aussi côté serveur — l'API ne rend plus les voisins vectoriels sous 0,3
 * (le client filtrait déjà ; les consommateurs directs de l'API voyaient
 * encore le bruit : « charabia → 5 résultats à 0,189 »). Les résultats
 * confirmés par la voie géographique (ancrés par un NOM) sont exemptés. */
const PLANCHER_SERVEUR = 0.3;
/** Audit du 23/08 : « où me former au numérique à Korhogo ? » remontait six
 * fiches d'infrastructure de Korhogo et zéro fiche formation — la voie géo
 * écrasait le sujet. Les correspondances géo SEULES (non confirmées par le
 * vecteur) sont plafonnées : le lieu ouvre la réponse, le sujet la remplit. */
const GEO_SEULS_MAX = 2;
/** Nombre de fiches de SUJET (recherche sans le toponyme) insérées après les
 * fiches du lieu. Audit du 23/08 : « où me former au numérique à Korhogo ? »
 * n'avait AUCUNE fiche de sujet dans le top-16 vectoriel — le toponyme
 * dominait l'embedding et remontait des villages au nom proche. La seconde
 * recherche, débarrassée du toponyme, laisse les fiches du plan stratégique
 * (« ce que l'ANSUT prévoit ») répondre quand aucune fiche locale n'existe. */
const SUJETS_MAX = 4;
/** Une fiche de lieu précis (village, site, zone blanche) que la voie géo n'a
 * PAS confirmée est presque sûrement le mauvais lieu : l'embedding accroche
 * un nom voisin (« KORHOGOLA » pour Korhogo). Rétrogradée derrière les
 * fiches de sujet. */
const TITRE_LIEU = /^(localité|bts|fibre|poste|site|abri|école|centre|zone blanche) — /i;
function estFicheDeLieu(row: { document_title: string; metadata: Record<string, unknown> | null }): boolean {
  if (TITRE_LIEU.test(row.document_title)) return true;
  return Boolean(row.metadata && typeof row.metadata.nom === "string" && row.metadata.nom.length > 0);
}

/**
 * GARDE-FOU DÉCISIONNEL — indépendant du prompt et de la visibilité.
 * Incident de salon : SUTA a restitué « non retenu », « score AIGF 0/100 »,
 * « vague de financement » à un citoyen. Même si une fiche de décision
 * repassait un jour en PUBLIC, elle ne sort pas d'ici : résultat écarté si
 * son titre est décisionnel, phrases de décision retirées du contenu et de
 * la localisation sinon. Un citoyen a droit aux faits (couverture,
 * infrastructures, population), jamais aux décisions de sélection.
 */
const TITRE_DECISIONNEL = /scoring|non[- ]retenue?|rang (national|régional)|vague de financement|\bs[ée]lection|priorisation/i;
// Audit du 23/08 : « 400 localités candidates, dont 350 sont retenues pour
// être équipées » passait la purge (aucun mot déclencheur dans la phrase).
// Les motifs (localités…retenues) et (retenues…équipées) la couvrent, en
// épargnant le français ordinaire (« les indicateurs retenus portent sur… »).
const PHRASE_DECISIONNELLE = /non[- ]retenue?s?\b|\bretenue?s?\b[^.]*\b(programme|vague|sélection|priorisation)|(localit[ée]s?|villages?)[^.]{0,80}\bretenue?s?\b|\bretenue?s?\b[^.]{0,80}[ée]quip|score (aigf|total|de priorisation)|rang (national|régional)|vague de financement|éligibilit|\bnon class|priorisation/i;

function purgerDecisions(texte: string): string {
  return texte
    .split(/(?<=[.!?;])\s+/)
    .filter((phrase) => !PHRASE_DECISIONNELLE.test(phrase))
    .join(" ")
    .trim();
}

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

/** Rend `null` si le résultat est décisionnel (titre) ou vidé par la purge. */
function formater(row: { document_title: string; section: string | null; content: string; metadata: Record<string, unknown> | null }, score: number) {
  if (TITRE_DECISIONNEL.test(row.document_title)) return null;
  const contenu = purgerDecisions(row.content);
  if (contenu.length === 0) return null;
  return {
    title: row.document_title,
    section: row.section,
    source: row.section ?? "Corpus ANSUT",
    score: Math.round(score * 1000) / 1000,
    location: extractLocation(row.metadata, row.document_title),
    content: contenu.slice(0, CONTENU_MAX),
    extrait: contenu.slice(0, 220),
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

    // Vague 2 de l'analyse Diakité (01/09) : les fiches de lieux SORTENT de
    // la voie vectorielle (`exclure_lieux`) — 23 883 chunks de gabarit sur
    // 25 996 formaient un plancher de bruit qui attrapait toute requête
    // vague (« recette du foutou » → un village). Une localité s'interroge
    // par son NOM : c'est la voie géographique, inchangée, qui les sert.
    const { data: matches, error } = await supabase.rpc("match_chunks", {
      query_embedding: `[${vector.join(",")}]`,
      match_count: PROFONDEUR_VECTEUR,
      allowed_visibility: VISIBILITE_IMPOSEE,
      exclure_lieux: true,
    });
    if (error) throw new Error(`Recherche : ${error.message}`);
    if (geoResult.error) throw new Error(`Recherche géo : ${geoResult.error.message}`);

    const geo = (geoResult.data ?? []) as GeoChunk[];
    const geoIds = new Set(geo.map((g) => g.chunk_id));
    const vectoriels = (matches as MatchedChunk[])
      .map((m) => ({
        row: m,
        score: Math.max(0, Math.min(1, 1 - m.distance)),
      }))
      .filter((v) => geoIds.has(v.row.chunk_id) || v.score >= PLANCHER_SERVEUR);

    // Recherche de SUJET : quand un toponyme est détecté, la même question
    // débarrassée du lieu dit le besoin (« où me former au numérique »).
    // Seconde passe vectorielle pour que le sujet ne soit pas noyé par le
    // lieu — c'est là que répondent les fiches du plan stratégique.
    const toponymesDetectes = [...new Set(
      geo.map((g) => g.toponyme).filter((t): t is string => Boolean(t)).map((t) => normaliser(t)),
    )];
    let querySujet = "";
    let sujets: { row: MatchedChunk; score: number }[] = [];
    if (toponymesDetectes.length > 0) {
      const motsSansLieu = query.split(/[^\p{L}-]+/u).filter((mot: string) => {
        const n = normaliser(mot);
        return n.length > 0 && !toponymesDetectes.some((t) => t === n || t.includes(n));
      });
      const porteurDeSujet = motsSansLieu.some((m: string) => {
        const n = normaliser(m);
        return n.length >= 3 && !MOTS_OUTILS.has(n);
      });
      const candidate = motsSansLieu.join(" ").trim();
      if (porteurDeSujet && candidate.length > 0 && normaliser(candidate) !== normaliser(query)) {
        querySujet = candidate;
        const embedSujet = await fetch(new URL("/openai/v1/embeddings", endpoint), {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ model: deployment, input: [querySujet.slice(0, 500)] }),
        });
        if (embedSujet.ok) {
          const { data: dataSujet } = await embedSujet.json();
          const { data: matchesSujet } = await supabase.rpc("match_chunks", {
            query_embedding: `[${(dataSujet[0].embedding as number[]).join(",")}]`,
            match_count: PROFONDEUR_VECTEUR,
            allowed_visibility: VISIBILITE_IMPOSEE,
            exclure_lieux: true,
          });
          sujets = ((matchesSujet ?? []) as MatchedChunk[])
            .map((m) => ({ row: m, score: Math.max(0, Math.min(1, 1 - m.distance)) }))
            .filter((v) => !estFicheDeLieu(v.row) && v.score >= PLANCHER_SERVEUR);
        }
      }
    }

    // Fusion : (1) trouvés par les deux voies — le lieu ET le sujet —,
    // (2) correspondances géographiques exactes restantes (la fiche du
    // village existe même si le vecteur l'a manquée), (3) reste vectoriel.
    const deuxVoies = vectoriels.filter((v) => geoIds.has(v.row.chunk_id));
    const idsRetenus = new Set(deuxVoies.map((v) => v.row.chunk_id));
    const geoSeuls = geo.filter((g) => !idsRetenus.has(g.chunk_id)).slice(0, GEO_SEULS_MAX);
    const dejaVus = new Set<string>([...idsRetenus, ...geoSeuls.map((g) => g.chunk_id)]);
    const sujetSeuls = sujets
      .filter((s) => !dejaVus.has(s.row.chunk_id) && !geoIds.has(s.row.chunk_id))
      .slice(0, SUJETS_MAX);
    sujetSeuls.forEach((s) => dejaVus.add(s.row.chunk_id));
    const vecteurSeuls = vectoriels.filter((v) => !geoIds.has(v.row.chunk_id) && !dejaVus.has(v.row.chunk_id));
    // Les fiches de sujet passent avant les fiches d'un lieu que la géo n'a
    // pas confirmé (mauvais village accroché par le nom).
    const vecteurSujets = vecteurSeuls.filter((v) => !estFicheDeLieu(v.row));
    const vecteurLieuxNonConfirmes = vecteurSeuls.filter((v) => estFicheDeLieu(v.row));

    const results = [
      ...deuxVoies.map((v) => formater(v.row, v.score)),
      ...geoSeuls.map((g, i) => formater(g, 0.5 - i * 0.01)),
      ...sujetSeuls.map((s) => formater(s.row, s.score)),
      ...vecteurSujets.map((v) => formater(v.row, v.score)),
      ...vecteurLieuxNonConfirmes.map((v) => formater(v.row, v.score)),
    ].filter((r): r is NonNullable<typeof r> => r !== null).slice(0, matchCount);

    // Journal temporaire (diagnostic du classement géographique) : jamais de
    // contenu de fiche, uniquement requête, toponymes et titres classés.
    console.log(JSON.stringify({
      query: query.slice(0, 120),
      toponymes: toponymesDetectes,
      querySujet: querySujet || null,
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
