"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUES_LABO } from "@/lib/langues/labo-langues";

/**
 * SUTA LAB — Laboratoire langues : le banc d'essai de l'oreille ivoirienne.
 *
 * Protocole (même esprit que le casting des voix : on ne croit que ce qu'on
 * mesure) : un locuteur enregistre une phrase dans sa langue, le service de
 * transcription la met par écrit, et C'EST LE LOCUTEUR qui juge — juste,
 * à peu près, faux. Les verdicts s'exportent en JSON pour nourrir la note
 * « SUTA et les langues de Côte d'Ivoire ».
 *
 * Tant que le service n'est pas branché (LABO_ASR_ENDPOINT, hébergé sur
 * Azure après la migration), la page fonctionne jusqu'à l'envoi et affiche
 * le mode d'emploi rendu par la route.
 */

const DUREE_MAX_MS = 30_000;

interface Essai {
  heure: string;
  langue: string;
  texte: string;
  traduction: string | null;
  verdict: "juste" | "à peu près" | "faux";
}

const GROUPES: { cle: string; titre: string }[] = [
  { cle: "mandé", titre: "Mandé (nord et ouest)" },
  { cle: "kwa", titre: "Kwa (centre et sud)" },
  { cle: "krou", titre: "Krou (sud-ouest)" },
  { cle: "gur", titre: "Gur / Sénoufo (nord)" },
  { cle: "véhiculaire", titre: "Véhiculaires régionales" },
];

function base64DuBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Lecture de l'audio impossible."));
    lecteur.onload = () => {
      const texte = String(lecteur.result ?? "");
      resolve(texte.slice(texte.indexOf(",") + 1));
    };
    lecteur.readAsDataURL(blob);
  });
}

export default function LaboLanguesPage() {
  const [code, setCode] = useState("dyu");
  const [phase, setPhase] = useState<"repos" | "enregistre" | "transcrit">("repos");
  const [status, setStatus] = useState("Choisissez une langue, puis enregistrez une phrase (30 s max).");
  const [resultat, setResultat] = useState<{ texte: string; traduction: string | null } | null>(null);
  const [essais, setEssais] = useState<Essai[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const morceauxRef = useRef<Blob[]>([]);
  const minuterieRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { recorderRef.current?.stream.getTracks().forEach((t) => t.stop()); }, []);

  async function demarrer() {
    setResultat(null);
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(flux);
      morceauxRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) morceauxRef.current.push(e.data); };
      recorder.onstop = () => { void transcrire(new Blob(morceauxRef.current, { type: recorder.mimeType })); flux.getTracks().forEach((t) => t.stop()); };
      recorder.start();
      recorderRef.current = recorder;
      setPhase("enregistre");
      setStatus("Enregistrement… parlez naturellement, puis arrêtez.");
      minuterieRef.current = setTimeout(() => arreter(), DUREE_MAX_MS);
    } catch {
      setStatus("Accès au microphone refusé ou indisponible. Autorisez le micro puis réessayez.");
    }
  }

  function arreter() {
    if (minuterieRef.current) { clearTimeout(minuterieRef.current); minuterieRef.current = null; }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
  }

  async function transcrire(blob: Blob) {
    setPhase("transcrit");
    setStatus("Transcription en cours…");
    try {
      const audio = await base64DuBlob(blob);
      const mime = (blob.type || "audio/webm").split(";")[0];
      const reponse = await fetch("/api/admin/labo-transcrire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio, mime, code }),
      });
      const corps = (await reponse.json().catch(() => ({}))) as { ok?: boolean; texte?: string; traduction?: string | null; error?: string };
      if (!reponse.ok || !corps.texte) {
        setPhase("repos");
        setStatus(corps.error ?? `La transcription a échoué (HTTP ${reponse.status}).`);
        return;
      }
      setResultat({ texte: corps.texte, traduction: corps.traduction ?? null });
      setPhase("repos");
      setStatus("À vous de juger : la transcription est-elle fidèle à ce qui a été dit ?");
    } catch {
      setPhase("repos");
      setStatus("Je n'ai pas pu joindre le service de transcription. Réessayez.");
    }
  }

  function juger(verdict: Essai["verdict"]) {
    if (!resultat) return;
    const langue = LANGUES_LABO.find((l) => l.code === code)?.nom ?? code;
    setEssais((liste) => [
      { heure: new Date().toISOString(), langue, texte: resultat.texte, traduction: resultat.traduction, verdict },
      ...liste,
    ]);
    setResultat(null);
    setStatus("Verdict enregistré. Enregistrez la phrase suivante quand vous voulez.");
  }

  async function copier() {
    await navigator.clipboard.writeText(JSON.stringify(essais, null, 2));
    setStatus(`${essais.length} essai(s) copiés au format JSON — à coller dans le compte rendu.`);
  }

  return <main className="min-h-screen bg-ansut-surface px-6 py-10 text-ansut-blue"><div className="mx-auto max-w-5xl">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-ansut-orange">SUTA LAB</p>
    <h1 className="mt-2 text-4xl font-semibold">Laboratoire langues</h1>
    <p className="mt-3 max-w-2xl text-ansut-text-muted">L&apos;oreille ivoirienne de SUTA, jugée par des oreilles ivoiriennes : enregistrez une phrase dans la langue choisie, lisez la transcription, dites si elle est fidèle. Jamais de vrais échanges citoyens ni d&apos;informations personnelles : des phrases de test uniquement.</p>

    {GROUPES.map(({ cle, titre }) => <section key={cle} className="mt-6">
      <h2 className="text-xs font-bold uppercase tracking-widest text-ansut-orange">{titre}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {LANGUES_LABO.filter((l) => l.groupe === cle).map((l) =>
          <button key={l.code} onClick={() => setCode(l.code)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${code === l.code ? "border-ansut-orange bg-white shadow" : "border-ansut-border bg-white/70 hover:shadow"}`}>
            {l.nom}{l.synthese ? " ·🔊" : ""}
          </button>)}
      </div>
    </section>)}
    <p className="mt-2 text-xs text-ansut-text-muted">🔊 = une voix de synthèse existe aussi pour cette langue (la « bouche », étape suivante du pilote).</p>

    <section className="mt-8 flex flex-wrap items-center gap-3">
      {phase !== "enregistre"
        ? <button onClick={() => void demarrer()} disabled={phase === "transcrit"} className="rounded-full bg-ansut-orange px-6 py-3 text-sm font-semibold text-white shadow hover:shadow-lg disabled:opacity-50">🎙️ Enregistrer (30 s max)</button>
        : <button onClick={arreter} className="rounded-full bg-ansut-blue px-6 py-3 text-sm font-semibold text-white shadow">⏹ Arrêter et transcrire</button>}
      <p className="text-sm font-medium">{status}</p>
    </section>

    {resultat && <section className="mt-6 rounded-3xl border border-ansut-border bg-white p-6">
      <h2 className="font-semibold">Transcription</h2>
      <p className="mt-2 text-lg leading-8">{resultat.texte}</p>
      {resultat.traduction && <p className="mt-2 text-ansut-text-muted"><span className="font-semibold">En français :</span> {resultat.traduction}</p>}
      <div className="mt-4 flex gap-3">
        <button onClick={() => juger("juste")} className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white">✓ Juste</button>
        <button onClick={() => juger("à peu près")} className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white">≈ À peu près</button>
        <button onClick={() => juger("faux")} className="rounded-full bg-rose-600 px-5 py-2 text-sm font-semibold text-white">✗ Faux</button>
      </div>
    </section>}

    {essais.length > 0 && <section className="mt-8 rounded-3xl border border-ansut-border bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Essais de la session ({essais.length})</h2>
        <button onClick={() => void copier()} className="rounded-full border border-ansut-border px-4 py-2 text-xs font-semibold">Copier les résultats (JSON)</button>
      </div>
      <ul className="mt-3 space-y-2">
        {essais.map((e, i) => <li key={i} className="rounded-xl bg-ansut-surface px-4 py-3 text-sm">
          <span className="font-semibold">{e.langue}</span> · {e.verdict} — <span className="text-ansut-text-muted">{e.texte.slice(0, 120)}</span>
        </li>)}
      </ul>
    </section>}
  </div></main>;
}
