#!/usr/bin/env node
/**
 * AGENT-CITOYEN — campagne conversationnelle (feu vert Patrick du 31/08).
 *
 * Là où run.mjs est un instrument de MESURE (stimuli figés, verdicts
 * PASS/FAIL, reproductible), campagne.mjs est un interlocuteur : il tient
 * une vraie conversation multi-tours avec SUTA en production — il écoute la
 * transcription de chaque réponse, choisit sa réplique suivante (relance,
 * localité demandée, interruption, changement de sujet) et la joue dans le
 * micro. Les répliques restent des WAV FIGÉS versionnés
 * (evals/suta/audio/campagne/, générés une fois par gen_repliques.py) :
 * aucun TTS dans la boucle — c'est le CHOIX de la réplique qui est
 * dynamique, pas sa synthèse.
 *
 * Différence technique avec run.mjs : le faux micro par fichier de Chromium
 * est un flag de lancement, impossible d'en changer en pleine session. La
 * campagne installe donc un micro virtuel PROGRAMMABLE dans le navigateur de
 * test (getUserMedia surchargé vers un MediaStreamDestination alimenté tour
 * par tour) — le site, lui, ne change pas d'un octet.
 *
 * Sortie : un rapport d'OBSERVATION par persona (transcript complet, temps
 * de réponse par tour, incidents), jamais un verdict PASS/FAIL — un échange
 * raté a vocation à devenir un stimulus figé du banc de mesure.
 *
 * Usage :
 *   node evals/suta/vocal-qa/campagne.mjs --url <URL> [--persona habitant]...
 *        [--footer-sha-min <sha>] [--headed] [--out-dir <dir>]
 *
 * Sans --persona : les trois personas (habitant, curieux, presse) défilent.
 * Convention anti-ADMIN : aucun contenu de fiche — transcripts d'écran,
 * titres, compteurs uniquement.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMANDE_LOCALITE_RE, OFFRE_SUITE_RE, PERSONAS } from "./personas.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const HERE = dirname(fileURLToPath(import.meta.url));
const REPLIQUES_DIR = process.env.SUTA_CAMPAGNE_AUDIO_DIR || resolve(HERE, "..", "audio", "campagne");
const DEFAULT_OUT_DIR = resolve(HERE, "..", "results", "local");
const SAMPLE_RATE = 24_000;
const SAMPLE_INTERVAL_MS = 400;
const ESTABLISH_TIMEOUT_MS = 25_000;
/** Une réponse (phrase d'attente + recherche + synthèse) doit arriver là-dedans. */
const REPONSE_TIMEOUT_MS = 45_000;
/** Marge d'écoute après la fin d'une réplique avant de guetter la réponse. */
const MARGE_APRES_PAROLE_MS = 800;
/** L'interruption part quand SUTA parle depuis ce temps-là. */
const DELAI_INTERRUPTION_MS = 2_500;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { url: null, personas: [], footerShaMin: null, headed: false, outDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => { i += 1; if (i >= argv.length) throw new Error(`Valeur manquante pour ${arg}`); return argv[i]; };
    switch (arg) {
      case "--url": opts.url = next(); break;
      case "--persona": opts.personas.push(next()); break;
      case "--footer-sha-min": opts.footerShaMin = next(); break;
      case "--headed": opts.headed = true; break;
      case "--out-dir": opts.outDir = next(); break;
      default: throw new Error(`Option inconnue : ${arg}`);
    }
  }
  if (!opts.url) throw new Error("--url est obligatoire. Ex. --url https://suta-bot-web.vercel.app");
  if (opts.personas.length === 0) opts.personas = Object.keys(PERSONAS);
  for (const p of opts.personas) {
    if (!PERSONAS[p]) throw new Error(`Persona inconnu : ${p} (disponibles : ${Object.keys(PERSONAS).join(", ")})`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// WAV (mêmes règles strictes que run.mjs : PCM 16 bits mono 24 kHz, sinon rejet)
// ---------------------------------------------------------------------------

function readWavPcm(path) {
  const buf = readFileSync(path);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path} : pas un fichier WAV (RIFF/WAVE)`);
  }
  let offset = 12; let fmt = null; let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === "fmt ") {
      fmt = {
        audioFormat: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4), bitsPerSample: buf.readUInt16LE(body + 14),
      };
    } else if (id === "data") data = buf.subarray(body, Math.min(body + size, buf.length));
    offset = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error(`${path} : chunks fmt/data introuvables`);
  if (fmt.audioFormat !== 1 || fmt.channels !== 1 || fmt.sampleRate !== SAMPLE_RATE || fmt.bitsPerSample !== 16) {
    throw new Error(`${path} : format inattendu (attendu PCM 16 bits mono ${SAMPLE_RATE} Hz — voir audio/README.md)`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Footer (mêmes règles que run.mjs)
// ---------------------------------------------------------------------------

async function readFooterSha(page) {
  const footer = page.locator("footer");
  await footer.waitFor({ state: "visible", timeout: 20_000 });
  const match = (await footer.innerText()).match(/v-([0-9a-f]{6,40}|dev)/i);
  return match ? match[1] : null;
}
function shaLooksValid(sha) { return /^[0-9a-f]{6,40}$/i.test(sha); }
function isKnownDescendant(ancestor, descendant) {
  if (!shaLooksValid(ancestor) || !shaLooksValid(descendant)) return false;
  try { execSync(`git merge-base --is-ancestor ${ancestor} ${descendant}`, { cwd: HERE, stdio: "ignore" }); return true; }
  catch { return false; }
}
function footerMatches(footerSha, expectedMin) {
  if (!expectedMin) return true;
  if (!footerSha) return false;
  const a = footerSha.toLowerCase(); const b = expectedMin.toLowerCase();
  if (a.startsWith(b) || b.startsWith(a)) return true;
  return isKnownDescendant(b, a);
}

// ---------------------------------------------------------------------------
// DOM (même lecture d'écran que run.mjs)
// ---------------------------------------------------------------------------

function domSnapshot() {
  const out = { last: null, asked: false, history: [], errorAlert: false, live: false };
  const lastP = document.querySelector('p[aria-live="polite"]');
  if (lastP) out.last = (lastP.textContent || "").trim();
  for (const p of document.querySelectorAll("p")) {
    if ((p.textContent || "").trim().startsWith("Vous avez demandé")) { out.asked = true; break; }
  }
  for (const b of document.querySelectorAll("button")) {
    if ((b.textContent || "").trim().startsWith("Voir l'historique")) { b.click(); break; }
  }
  for (const li of document.querySelectorAll("ul li")) {
    const t = (li.textContent || "").trim();
    if (t.startsWith("Vous :")) out.history.push({ role: "user", text: t.slice("Vous :".length).trim() });
    else if (t.startsWith("SUTA :")) out.history.push({ role: "suta", text: t.slice("SUTA :".length).trim() });
  }
  out.errorAlert = Boolean(document.querySelector('[role="alert"]'));
  const orb = document.querySelector('button[aria-label*="microphone"], button[aria-label="Raccrocher"]');
  out.live = orb ? orb.getAttribute("aria-pressed") === "true" : false;
  return out;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Une conversation (un persona)
// ---------------------------------------------------------------------------

async function runPersona({ personaId, opts, executablePath, gitSha, outDir }) {
  const persona = PERSONAS[personaId];
  const t0 = Date.now();
  const rel = () => Date.now() - t0;
  const workDir = join(outDir, personaId);
  mkdirSync(workDir, { recursive: true });

  const voix = []; const consoleTasks = []; const sessions = []; const searches = [];
  const pageErrors = []; const samples = []; const tours = []; const incidents = [];
  let footerSha = null; let webm = null; let meter = null;

  const browser = await chromium.launch({
    executablePath,
    headless: !opts.headed,
    args: [
      "--no-sandbox", "--disable-dev-shm-usage",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });

  try {
    const context = await browser.newContext();
    try { await context.grantPermissions(["microphone"], { origin: new URL(opts.url).origin }); } catch { /* selon l'URL */ }
    const page = await context.newPage();

    // Micro virtuel PROGRAMMABLE : getUserMedia rend un flux alimenté par
    // __citoyenParle(base64Pcm16Mono, sampleRate). Instrumentation du
    // navigateur de test uniquement — le site ne change pas.
    await page.addInitScript(() => {
      const citoyen = { ctx: null, dest: null, prochainDebut: 0 };
      // @ts-expect-error instrumentation de la campagne
      window.__citoyen = citoyen;
      const naturel = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (contraintes) => {
        if (!contraintes || !contraintes.audio) return naturel(contraintes);
        if (!citoyen.ctx) {
          citoyen.ctx = new AudioContext({ sampleRate: 48_000 });
          citoyen.dest = citoyen.ctx.createMediaStreamDestination();
          citoyen.ctx.resume().catch(() => {});
        }
        return citoyen.dest.stream;
      };
      // @ts-expect-error instrumentation de la campagne
      window.__citoyenParle = (b64, sampleRate) => {
        if (!citoyen.ctx) return 0;
        const bin = atob(b64);
        const n = Math.floor(bin.length / 2);
        const flottants = new Float32Array(n);
        for (let i = 0; i < n; i += 1) {
          let v = (bin.charCodeAt(2 * i + 1) << 8) | bin.charCodeAt(2 * i);
          if (v >= 0x8000) v -= 0x10000;
          flottants[i] = v / 32768;
        }
        const tampon = citoyen.ctx.createBuffer(1, n, sampleRate);
        tampon.getChannelData(0).set(flottants);
        const source = citoyen.ctx.createBufferSource();
        source.buffer = tampon;
        source.connect(citoyen.dest);
        const debut = Math.max(citoyen.prochainDebut, citoyen.ctx.currentTime + 0.05);
        source.start(debut);
        citoyen.prochainDebut = debut + tampon.duration;
        return Math.round(tampon.duration * 1000);
      };
      // Sortie audio de SUTA : enveloppe RMS + enregistrement webm (même
      // interception srcObject que run.mjs).
      const etat = { meter: [], chunks: [], rec: null, erreur: null };
      // @ts-expect-error instrumentation de la campagne
      window.__sutaSortie = etat;
      const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "srcObject");
      if (!desc || !desc.set || !desc.get) return;
      Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
        configurable: true,
        get() { return desc.get.call(this); },
        set(flux) {
          desc.set.call(this, flux);
          if (!flux || typeof MediaStream === "undefined" || !(flux instanceof MediaStream)) return;
          try {
            const ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(flux);
            const analyseur = ctx.createAnalyser();
            analyseur.fftSize = 2048;
            source.connect(analyseur);
            ctx.resume().catch(() => {});
            const tampon = new Uint8Array(analyseur.fftSize);
            setInterval(() => {
              analyseur.getByteTimeDomainData(tampon);
              let somme = 0;
              for (let i = 0; i < tampon.length; i += 1) { const d = (tampon[i] - 128) / 128; somme += d * d; }
              etat.meter.push({ t: performance.now(), rms: Math.sqrt(somme / tampon.length) });
            }, 100);
            const type = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
            const rec = type ? new MediaRecorder(flux, { mimeType: type }) : new MediaRecorder(flux);
            rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) etat.chunks.push(e.data); };
            rec.start(1_000);
            etat.rec = rec;
          } catch (e) { etat.erreur = String(e); }
        },
      });
    });

    page.on("console", (msg) => {
      const t = rel();
      consoleTasks.push((async () => {
        let text = msg.text();
        try {
          const args = msg.args();
          if (args.length > 0) {
            const values = await Promise.all(args.map((a) => a.jsonValue().catch(() => undefined)));
            if (typeof values[0] === "string") {
              text = values.filter((v) => v !== undefined && v !== "")
                .map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
            }
          }
        } catch { /* page fermée */ }
        if (text.includes("[suta:voix]")) voix.push({ t, text });
      })());
    });
    page.on("pageerror", (error) => pageErrors.push({ t: rel(), message: String(error?.message ?? error) }));
    const pathnameOf = (url) => { try { return new URL(url).pathname; } catch { return ""; } };
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      const path = pathnameOf(request.url());
      if (path.endsWith("/api/realtime/session")) sessions.push({ t: rel() });
      else if (path.endsWith("/api/tools/search-knowledge")) {
        let query = null;
        try { query = JSON.parse(request.postData() ?? "{}").query ?? null; } catch { /* corps illisible */ }
        searches.push({ t: rel(), query });
      }
    });

    await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    try { footerSha = await readFooterSha(page); } catch { /* footer illisible */ }
    if (opts.footerShaMin && !footerMatches(footerSha, opts.footerShaMin)) {
      return { personaId, statut: "REFUSED_WRONG_BUILD", footerSha, tours, incidents: [`Footer v-${footerSha ?? "?"} ≠ ${opts.footerShaMin}`], durationMs: rel() };
    }

    // Démarrage de la session vocale.
    const orb = page.locator('button[aria-label*="Activer le microphone"]');
    await orb.waitFor({ state: "visible", timeout: 15_000 });
    const tClick = rel();
    await orb.click();
    let established = false; let clicsOrbe = 1;
    while (rel() - tClick < ESTABLISH_TIMEOUT_MS) {
      if (sessions.length === 0 && clicsOrbe < 3 && rel() - tClick > clicsOrbe * 5_000) {
        clicsOrbe += 1;
        await orb.click().catch(() => {});
      }
      const sample = await page.evaluate(domSnapshot).catch(() => null);
      if (sample) samples.push({ t: rel(), ...sample });
      if (sample?.live) { established = true; break; }
      if (sample?.errorAlert) break;
      await sleep(SAMPLE_INTERVAL_MS);
    }
    if (!established) {
      return { personaId, statut: "ERROR_ENV", footerSha, tours, incidents: ["Session vocale non établie (voir run.mjs pour le diagnostic)."], durationMs: rel() };
    }

    // Outils de dialogue -----------------------------------------------------
    const sampleNow = async () => {
      const s = await page.evaluate(domSnapshot).catch(() => null);
      if (s) samples.push({ t: rel(), ...s });
      return s;
    };
    /** « transcript terminé » (dédupliqués <1 s) postérieurs à t. */
    const transcriptsApres = (t) => {
      const evts = voix.filter((e) => e.text.includes("transcript terminé") && e.t > t).sort((a, b) => a.t - b.t);
      const propres = [];
      for (const e of evts) {
        const prev = propres[propres.length - 1];
        if (!prev || e.t - prev.t > 1_000) propres.push(e);
      }
      return propres;
    };
    const premierDeltaApres = (t) => voix.find((e) => e.text.includes("premier delta") && e.t > t) ?? null;
    const parler = async (file) => {
      const pcm = readWavPcm(join(REPLIQUES_DIR, file));
      const dureeMs = await page.evaluate(
        ({ b64, sr }) => window.__citoyenParle(b64, sr),
        { b64: pcm.toString("base64"), sr: SAMPLE_RATE },
      );
      const t = rel();
      console.log(`  [${personaId}] citoyen → ${file} (${(dureeMs / 1000).toFixed(1)} s)`);
      await sleep(dureeMs + MARGE_APRES_PAROLE_MS);
      return t;
    };
    /** Attend la fin de la réponse suivante ; rend { t, texte } ou null. */
    const attendreReponse = async (apresT) => {
      const debut = rel();
      while (rel() - debut < REPONSE_TIMEOUT_MS) {
        await sampleNow();
        const done = transcriptsApres(apresT);
        if (done.length > 0) {
          await sleep(700);
          const s = await sampleNow();
          return { t: done[done.length - 1].t, texte: s?.last ?? "" };
        }
        await sleep(SAMPLE_INTERVAL_MS);
      }
      return null;
    };

    // Boucle de conversation -------------------------------------------------
    let scriptIdx = 0;
    let relancesRestantes = persona.relances;
    let localiteJouee = false;
    let derniereReponse = "";
    let toursSansReponse = 0;

    while (scriptIdx < persona.script.length) {
      // 1. Choix de la réplique : réflexes d'abord, script sinon.
      let file; let raison;
      if (!localiteJouee && persona.localite && DEMANDE_LOCALITE_RE.test(derniereReponse)) {
        file = persona.localite; raison = "SUTA a demandé la localité";
        localiteJouee = true;
      } else if (relancesRestantes > 0 && persona.relance && OFFRE_SUITE_RE.test(derniereReponse)) {
        file = persona.relance; raison = "SUTA a offert d'en dire plus";
        relancesRestantes -= 1;
      } else {
        file = persona.script[scriptIdx]; raison = "script";
        scriptIdx += 1;
      }
      const interrompt = (persona.interruptions ?? []).includes(file);

      // 2. Interruption : attendre que SUTA parle, puis lui couper la parole.
      if (interrompt) {
        const tAttente = rel();
        let delta = null;
        while (rel() - tAttente < REPONSE_TIMEOUT_MS) {
          delta = premierDeltaApres(tours.length > 0 ? tours[tours.length - 1].tParole : tClick);
          if (delta) break;
          await sampleNow();
          await sleep(SAMPLE_INTERVAL_MS);
        }
        if (delta) {
          const attente = delta.t + DELAI_INTERRUPTION_MS - rel();
          if (attente > 0) await sleep(attente);
        } else {
          incidents.push(`Tour ${tours.length + 1} : interruption prévue mais SUTA n'a jamais commencé à parler.`);
        }
      }

      // 3. Parole du citoyen, puis attente de la réponse.
      const tParole = await parler(file);
      const reponse = await attendreReponse(tParole);
      const tour = {
        n: tours.length + 1, replique: file, raison, interrompt,
        tParole, reponseMs: reponse ? reponse.t - tParole : null,
        reponse: reponse?.texte ?? null,
      };
      tours.push(tour);
      if (!reponse) {
        toursSansReponse += 1;
        incidents.push(`Tour ${tour.n} (${file}) : aucune réponse en ${REPONSE_TIMEOUT_MS / 1000} s.`);
        if (toursSansReponse >= 2) { incidents.push("Deux tours sans réponse : conversation abandonnée."); break; }
      } else {
        toursSansReponse = 0;
        derniereReponse = reponse.texte;
      }
    }

    // Fin de conversation : laisser retomber, puis collecter l'audio sortant.
    await sleep(2_000);
    const relAvantAudio = rel();
    const brut = await page.evaluate(async () => {
      // @ts-expect-error instrumentation de la campagne
      const s = window.__sutaSortie;
      if (!s) return null;
      try { s.rec?.stop(); } catch { /* déjà arrêté */ }
      await new Promise((r) => setTimeout(r, 400));
      const blob = new Blob(s.chunks, { type: "audio/webm" });
      const base64 = await new Promise((resolveFr) => {
        const fr = new FileReader();
        fr.onload = () => resolveFr(String(fr.result).split(",")[1] ?? "");
        fr.onerror = () => resolveFr("");
        fr.readAsDataURL(blob);
      });
      return { pageNow: performance.now(), meter: s.meter, webmBase64: base64 };
    }).catch(() => null);
    if (brut) {
      const offset = brut.pageNow - relAvantAudio;
      meter = (brut.meter ?? []).map((m) => ({ t: Math.round(m.t - offset), rms: Number(m.rms.toFixed(4)) }));
      if (brut.webmBase64) webm = Buffer.from(brut.webmBase64, "base64");
    }
    await context.close();
  } finally {
    await browser.close().catch(() => {});
    await Promise.allSettled(consoleTasks);
  }

  // Incidents mécaniques observés dans les logs.
  voix.sort((a, b) => a.t - b.t);
  const cancelsInattendus = voix.filter((e) => e.text.includes("unexpected_cancel")).length;
  if (cancelsInattendus > 0) incidents.push(`${cancelsInattendus} annulation(s) inattendue(s) (unexpected_cancel).`);
  if (sessions.length > 1) incidents.push(`${sessions.length} sessions Realtime créées (reconnexion en cours de conversation).`);
  if (pageErrors.length > 0) incidents.push(`${pageErrors.length} erreur(s) JavaScript de page.`);

  // Artefacts.
  const dernier = samples.filter((s) => s.history.length > 0 || s.last).pop();
  const histoire = dernier ? dernier.history : [];
  writeFileSync(join(outDir, personaId, "events.json"), JSON.stringify({
    persona: personaId, footerSha, gitSha, tours, incidents, voix, sessions, searches,
    pageErrors, meter, samples: samples.slice(-20),
  }, null, 1));
  if (webm) writeFileSync(join(outDir, personaId, "sortie.webm"), webm);
  const md = [
    `# Campagne — persona « ${personaId} » (${persona.description})`,
    "",
    `Site : ${opts.url} — footer v-${footerSha ?? "?"} — clone ${gitSha}`,
    "",
    "## Tours",
    "",
    ...tours.map((t) => [
      `### Tour ${t.n} — ${t.replique}${t.interrompt ? " (INTERRUPTION)" : ""}`,
      `- Choix : ${t.raison}`,
      `- Réponse de SUTA : ${t.reponseMs != null ? `${(t.reponseMs / 1000).toFixed(1)} s` : "AUCUNE (timeout)"}`,
      t.reponse ? `- « ${t.reponse} »` : "",
      "",
    ].filter(Boolean).join("\n")),
    "## Historique d'écran (fin de conversation)",
    "",
    ...histoire.map((m) => `- ${m.role === "user" ? "Citoyen" : "SUTA"} : ${m.text}`),
    "",
    "## Incidents",
    "",
    incidents.length > 0 ? incidents.map((i) => `- ${i}`).join("\n") : "- Aucun.",
    "",
  ].join("\n");
  writeFileSync(join(outDir, personaId, "conversation.md"), md);

  return {
    personaId, statut: "OBSERVE", footerSha, tours, incidents,
    durationMs: rel(),
    reponsesRecues: tours.filter((t) => t.reponseMs != null).length,
  };
}

// ---------------------------------------------------------------------------
// Entrée
// ---------------------------------------------------------------------------

function resolveChromiumExecutable() {
  const candidates = [process.env.CHROMIUM_PATH];
  try { candidates.push(chromium.executablePath()); } catch { /* registre absent */ }
  candidates.push("/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome-stable", "/usr/bin/google-chrome");
  for (const c of candidates) if (c && existsSync(c)) return c;
  throw new Error("Chromium introuvable. Définissez CHROMIUM_PATH=<chemin du binaire>.");
}

async function main() {
  const opts = parseArgs(process.argv);
  const executablePath = resolveChromiumExecutable();
  let gitSha = "?";
  try { gitSha = execSync("git rev-parse --short HEAD", { cwd: HERE }).toString().trim(); } catch { /* hors clone */ }
  const stamp = new Date().toISOString().slice(0, 10);
  const baseOut = opts.outDir ? resolve(opts.outDir) : DEFAULT_OUT_DIR;

  const resultats = [];
  let outDir = null;
  for (const personaId of opts.personas) {
    console.log(`\n=== Persona « ${personaId} » ===`);
    if (!outDir) outDir = join(baseOut, `campagne-${stamp}-pending`);
    mkdirSync(outDir, { recursive: true });
    const r = await runPersona({ personaId, opts, executablePath, gitSha, outDir });
    resultats.push(r);
    console.log(`  → ${r.statut} — ${r.tours.length} tours, ${r.reponsesRecues ?? 0} réponses, ${r.incidents.length} incident(s)`);
  }

  // Le dossier prend le footer réellement observé.
  const footer = resultats.find((r) => r.footerSha)?.footerSha ?? "inconnu";
  const finalDir = join(baseOut, `campagne-${stamp}-${footer}`);
  if (outDir && outDir !== finalDir && !existsSync(finalDir)) {
    try { renameSync(outDir, finalDir); outDir = finalDir; } catch { /* on garde pending */ }
  }

  const lignes = resultats.map((r) =>
    `| ${r.personaId} | ${r.statut} | ${r.tours.length} | ${r.reponsesRecues ?? 0} | ${r.incidents.length} |`);
  const synthese = [
    `# Campagne conversationnelle — ${stamp} — v-${footer}`,
    "",
    "| Persona | Statut | Tours | Réponses | Incidents |",
    "|---|---|---|---|---|",
    ...lignes,
    "",
    "Détail par persona : conversation.md + events.json + sortie.webm dans le sous-dossier.",
    "Un tour raté ici a vocation à devenir un stimulus figé du banc de mesure (run.mjs).",
    "",
  ].join("\n");
  writeFileSync(join(outDir ?? baseOut, "synthese.md"), synthese);
  console.log(`\n${synthese}`);
  console.log(`Artefacts : ${outDir}`);
}

main().catch((error) => {
  console.error(`ERREUR : ${error?.message ?? error}`);
  process.exit(1);
});
