#!/usr/bin/env node
/**
 * Banc d'évaluation SUTA — exécution RÉELLE des cas contre l'Edge Function
 * `search-knowledge` de production (le même chemin que l'application).
 *
 * Usage :
 *   node evals/suta/run-cases.mjs            # tous les cas hors REALTIME
 *   node evals/suta/run-cases.mjs STRAT-001  # un cas précis
 *
 * Aucune dépendance (Node ≥ 18). La clé utilisée est la clé PUBLIABLE déjà
 * committée dans apps/web/src/lib/supabase-edge.ts : elle n'ouvre que
 * l'invocation des Edge Functions (RLS deny-all sur les tables), et la
 * fonction impose PUBLIC+DEMO côté serveur — un appelant ne peut PAS
 * atteindre le corpus ADMIN, quoi qu'il demande.
 *
 * SORTIE (règle de capture — jamais de contenu de fiche, même public :
 * uniquement rang, titre, score, source, verdicts) :
 *   evals/suta/results/<date>-<sha>.jsonl — une ligne par cas :
 *   { id, family, question, http, latencyMs,
 *     results: [{ rank, title, score, source }],
 *     termesInterdits: bool,   // regex décisionnelle sur la réponse brute
 *     verdictAuto }            // OK_RETRIEVAL | VIDE | TERMES_INTERDITS | HTTP_<code>
 * Le verdict final (OK / défaut corpus-lien / défaut moteur-retrieval) reste
 * un jugement humain/agent à partir de ces traces + ideal_answer.
 *
 * Les cas family=REALTIME ne passent pas ici : ils se jugent sur les logs
 * [suta:voix] d'une session vocale réelle (RT-003 est aussi couvert par le
 * dédoublonnage testé dans apps/web).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Mêmes valeurs par défaut que apps/web/src/lib/supabase-edge.ts.
const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://rnschtjccillctzqnqrb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_b5IVvRdBqwdPWrqt0NPmxQ_fgTyGn8B";

/** Termes de décision interne : leur présence dans la réponse est un échec. */
const TERMES_INTERDITS =
  /non[- ]retenu|\bretenue?s?\b|scoring|score aigf|rang (national|régional)|vague de financement|éligibilit|non class|priorisation/i;

/** L'instance est petite (nano) : exécution STRICTEMENT sérielle, avec pause. */
const PAUSE_MS = 500;

function loadCases() {
  const cases = [];
  for (const file of ["strategic-cases.jsonl", "conversation-cases.jsonl"]) {
    try {
      for (const line of readFileSync(join(here, file), "utf8").split("\n")) {
        if (line.trim()) cases.push(JSON.parse(line));
      }
    } catch { /* fichier absent : on continue */ }
  }
  return cases.filter((c) => c.family !== "REALTIME");
}

async function runCase(c) {
  const started = Date.now();
  let response, body;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/search-knowledge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: c.question, limit: 5 }),
    });
    body = await response.text();
  } catch (error) {
    return { id: c.id, family: c.family, question: c.question, http: 0, latencyMs: Date.now() - started, results: [], termesInterdits: false, verdictAuto: `RESEAU: ${error.message}` };
  }
  const latencyMs = Date.now() - started;
  let results = [];
  try {
    const parsed = JSON.parse(body);
    results = (parsed.results ?? []).map((r, i) => ({
      rank: i + 1,
      title: r.title,
      score: r.score,
      source: r.source,
    }));
  } catch { /* corps illisible : results vide */ }
  // La regex balaie le corps ENTIER (contenus compris) mais seuls les champs
  // aseptisés ci-dessus sont conservés dans le fichier de résultats.
  const termesInterdits = TERMES_INTERDITS.test(
    body.replace(JSON.stringify(c.question).slice(1, -1), ""), // sans l'écho de la question
  );
  const verdictAuto = response.status !== 200 ? `HTTP_${response.status}`
    : termesInterdits ? "TERMES_INTERDITS"
    : results.length === 0 ? "VIDE"
    : "OK_RETRIEVAL";
  return { id: c.id, family: c.family, question: c.question, http: response.status, latencyMs, results, termesInterdits, verdictAuto };
}

const filtre = process.argv[2];
const cases = loadCases().filter((c) => !filtre || c.id === filtre);
if (cases.length === 0) { console.error("Aucun cas à exécuter."); process.exit(1); }

let sha = "unknown";
try { sha = execSync("git rev-parse --short HEAD", { cwd: here }).toString().trim(); } catch { /* hors dépôt */ }

const lignes = [];
for (const c of cases) {
  const row = await runCase(c);
  lignes.push(JSON.stringify(row));
  console.log(`${row.id.padEnd(18)} ${row.verdictAuto.padEnd(16)} ${row.latencyMs}ms  top1: ${row.results[0]?.title ?? "—"}`);
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}

mkdirSync(join(here, "results"), { recursive: true });
const out = join(here, "results", `${new Date().toISOString().slice(0, 10)}-${sha}.jsonl`);
writeFileSync(out, lignes.join("\n") + "\n");
console.log(`\nRésultats : ${out}`);
