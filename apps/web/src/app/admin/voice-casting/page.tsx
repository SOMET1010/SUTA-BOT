"use client";

import { useRef, useState } from "react";
import { RealtimeClient } from "@/lib/realtime/RealtimeClient";

/**
 * Casting réel des voix gpt-realtime (GA) : même phrase française/ivoirienne
 * pour toutes, toponymes compris — on juge le rendu, pas la fiche technique.
 * Le retour de terrain sur « cedar » (masculine mais française trop
 * anglophone) impose d'auditionner TOUTES les voix du modèle.
 */
const VOICES: { name: string; note: string }[] = [
  { name: "cedar", note: "masculine — voix actuelle" },
  { name: "ash", note: "masculine" },
  { name: "echo", note: "masculine" },
  { name: "verse", note: "masculine" },
  { name: "ballad", note: "masculine" },
  { name: "alloy", note: "neutre" },
  { name: "marin", note: "féminine" },
  { name: "sage", note: "féminine" },
  { name: "coral", note: "féminine" },
  { name: "shimmer", note: "féminine" },
];

const SCRIPT =
  "Bonjour, je suis SUTA, l'assistant de l'ANSUT. Dites-moi le nom de votre village et je regarde avec vous. " +
  "Par exemple : Korhogo, Sinématiali, Jacqueville ou Djacé. On est ensemble.";

export default function VoiceCastingPage() {
  const clientRef = useRef<RealtimeClient | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState("Choisissez une voix : toutes lisent exactement le même texte.");

  async function audition(voice: string) {
    clientRef.current?.disconnect(); clientRef.current = null; setActive(voice); setStatus(`Connexion à ${voice}…`);
    try {
      const response = await fetch("/api/realtime/session", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ voice }) });
      const session = await response.json(); if (!response.ok || !session.webrtcUrl) throw new Error(session.error || "Session vocale indisponible");
      const client = new RealtimeClient({ clientSecret:session.clientSecret, webrtcUrl:session.webrtcUrl, executeTool:async()=>({}), callbacks:{ onConnectionStateChange:(s)=>setStatus(s==="connected"?`${voice} — écoutez…`:s), onError:setStatus } });
      clientRef.current=client; await client.connect(); client.sendUserText(`Lis uniquement le texte suivant, naturellement, sans ajouter de commentaire : ${SCRIPT}`);
    } catch(error) { setStatus(error instanceof Error?error.message:"Erreur de casting"); setActive(null); }
  }

  return <main className="min-h-screen bg-ansut-surface px-6 py-10 text-ansut-blue"><div className="mx-auto max-w-5xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-ansut-orange">SUTA LAB</p><h1 className="mt-2 text-4xl font-semibold">Casting de la voix SUTA</h1><p className="mt-3 max-w-2xl text-ansut-text-muted">Même texte, même moteur, seule la voix change. Jugez le rendu réel : français naturel, chaleur, jeunesse, prononciation ivoirienne acceptable — et aucune intonation anglo-américaine marquée.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{VOICES.map(({name,note})=><button key={name} onClick={()=>audition(name)} className={`rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg ${active===name?"border-ansut-orange bg-white shadow-lg":"border-ansut-border bg-white/70"}`}><span className="text-xs font-bold uppercase tracking-widest text-ansut-orange">{note}</span><strong className="mt-2 block text-2xl capitalize">{name}</strong><span className="mt-4 inline-block rounded-full bg-ansut-blue px-4 py-2 text-xs font-semibold text-white">Écouter</span></button>)}</div><section className="mt-8 rounded-3xl border border-ansut-border bg-white p-6"><h2 className="font-semibold">Phrase témoin</h2><p className="mt-3 leading-7 text-ansut-text-muted">{SCRIPT}</p></section><p className="mt-5 text-sm font-medium">{status}</p><section className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white p-4">1. Français naturel — aucune intonation anglo-américaine marquée</div><div className="rounded-2xl bg-white p-4">2. Prononciation : ANSUT, SUTA, Korhogo, Sinématiali, Jacqueville, Djacé</div><div className="rounded-2xl bg-white p-4">3. Chaleur et jeunesse pour un service public</div><div className="rounded-2xl bg-white p-4">4. Conversation vivante, pas voix de standard téléphonique</div></section></div></main>;
}
