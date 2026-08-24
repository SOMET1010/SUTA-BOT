"use client";

import { useRef, useState } from "react";

/**
 * Labo de la voix native (lot 3) : entendre la « bouche » Azure Speech sans
 * toucher au site public. Même phrase témoin que le casting realtime — on
 * compare des voix, pas des textes. Quand la voix custom Jùlaba existera
 * (Custom Neural Voice), il suffira d'entrer son nom ici pour l'écouter.
 */
const SCRIPT =
  "Bonjour, je suis SUTA, l'assistant de l'ANSUT. Dites-moi le nom de votre village et je regarde avec vous. " +
  "Par exemple : Korhogo, Sinématiali, Jacqueville ou Djacé. On est ensemble.";

const VOIX_DEFAUT = "fr-FR-DeniseNeural";

export default function VoiceLabPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [texte, setTexte] = useState(SCRIPT);
  const [voix, setVoix] = useState(VOIX_DEFAUT);
  const [enCours, setEnCours] = useState(false);
  const [status, setStatus] = useState("La bouche Azure Speech, en direct — la voix custom Jùlaba s'écoutera ici.");

  async function ecouter() {
    setEnCours(true); setStatus("Synthèse en cours…");
    try {
      const response = await fetch("/api/voice/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texte, voice: voix.trim() || undefined }),
      });
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Erreur ${response.status}`);
      }
      const url = URL.createObjectURL(await response.blob());
      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setStatus(`Lecture — voix « ${voix.trim() || VOIX_DEFAUT} ».`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur de synthèse");
    } finally {
      setEnCours(false);
    }
  }

  return <main className="min-h-screen bg-ansut-surface px-6 py-10 text-ansut-blue"><div className="mx-auto max-w-3xl">
    <p className="text-xs font-bold uppercase tracking-[.2em] text-ansut-orange">SUTA LAB</p>
    <h1 className="mt-2 text-4xl font-semibold">Labo voix native</h1>
    <p className="mt-3 text-ansut-text-muted">Ressource DTDI-AZURESPEECH-SUTA-01. La clé reste côté serveur : cette page n&apos;envoie que du texte.</p>
    <section className="mt-8 rounded-3xl border border-ansut-border bg-white p-6">
      <label className="block text-sm font-semibold" htmlFor="voix">Voix Azure (standard ou custom)</label>
      <input id="voix" value={voix} onChange={(e) => setVoix(e.target.value)} placeholder={VOIX_DEFAUT}
        className="mt-2 w-full rounded-xl border border-ansut-border px-4 py-2.5" />
      <label className="mt-5 block text-sm font-semibold" htmlFor="texte">Texte à prononcer</label>
      <textarea id="texte" value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} maxLength={600}
        className="mt-2 w-full rounded-xl border border-ansut-border px-4 py-2.5 leading-7" />
      <button onClick={ecouter} disabled={enCours || !texte.trim()}
        className="mt-5 rounded-full bg-ansut-orange px-6 py-2.5 text-sm font-semibold text-white shadow hover:shadow-lg disabled:opacity-50">
        {enCours ? "Synthèse…" : "Écouter"}
      </button>
      <p className="mt-4 text-sm font-medium">{status}</p>
    </section>
    <p className="mt-5 text-sm text-ansut-text-muted">Critère d&apos;écoute, le même que le casting : cette voix donne-t-elle l&apos;impression que SUTA appartient naturellement à la Côte d&apos;Ivoire ?</p>
  </div></main>;
}
