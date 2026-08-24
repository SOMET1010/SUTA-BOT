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
  { name: "marin", note: "féminine — voix actuelle (casting du 24/08)" },
  { name: "sage", note: "féminine" },
  { name: "coral", note: "féminine" },
  { name: "shimmer", note: "féminine" },
  { name: "alloy", note: "neutre" },
  { name: "cedar", note: "masculine — écartée : accent nord-américain en français" },
  { name: "ash", note: "masculine" },
  { name: "echo", note: "masculine" },
  { name: "verse", note: "masculine" },
  { name: "ballad", note: "masculine" },
];

const SCRIPT =
  "Bonjour, je suis SUTA, l'assistant de l'ANSUT. Dites-moi le nom de votre village et je regarde avec vous. " +
  "Par exemple : Korhogo, Sinématiali, Jacqueville ou Djacé. On est ensemble.";

/** Finalistes du casting à l'aveugle (protocole du 24/08) : les voix
 * féminines + la voix actuelle, mélangées et anonymisées A/B/C/D — on juge
 * l'appartenance, pas l'étiquette. */
const FINALISTES = ["marin", "sage", "coral", "shimmer"];
const LETTRES = ["A", "B", "C", "D"];

export default function VoiceCastingPage() {
  const clientRef = useRef<RealtimeClient | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState("Choisissez une voix : toutes lisent exactement le même texte.");
  const [aveugle, setAveugle] = useState<string[] | null>(null);
  const [revele, setRevele] = useState(false);

  async function audition(voice: string, etiquette?: string) {
    const nom = etiquette ?? voice;
    clientRef.current?.disconnect(); clientRef.current = null; setActive(voice); setStatus(`Connexion à ${nom}…`);
    try {
      const response = await fetch("/api/realtime/session", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ voice }) });
      const session = await response.json(); if (!response.ok || !session.webrtcUrl) throw new Error(session.error || "Session vocale indisponible");
      const client = new RealtimeClient({ clientSecret:session.clientSecret, webrtcUrl:session.webrtcUrl, executeTool:async()=>({}), callbacks:{ onConnectionStateChange:(s)=>setStatus(s==="connected"?`${nom} — écoutez…`:s), onError:setStatus } });
      clientRef.current=client; await client.connect(); client.sendUserText(`Lis uniquement le texte suivant, naturellement, sans ajouter de commentaire : ${SCRIPT}`);
    } catch(error) { setStatus(error instanceof Error?error.message:"Erreur de casting"); setActive(null); }
  }

  function demarrerAveugle() {
    const melange = [...FINALISTES];
    for (let i = melange.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [melange[i], melange[j]] = [melange[j], melange[i]]; }
    setAveugle(melange); setRevele(false); setActive(null);
    setStatus("Casting à l'aveugle : écoutez A, B, C et D dans l'ordre que vous voulez, notez vos critères, puis révélez.");
  }

  return <main className="min-h-screen bg-ansut-surface px-6 py-10 text-ansut-blue"><div className="mx-auto max-w-5xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-ansut-orange">SUTA LAB</p><h1 className="mt-2 text-4xl font-semibold">Casting de la voix SUTA</h1><p className="mt-3 max-w-2xl text-ansut-text-muted">Même texte, même moteur, seule la voix change. Le vrai critère : laquelle donne le plus l&apos;impression que SUTA appartient naturellement à la Côte d&apos;Ivoire ?</p>
    <div className="mt-6 flex flex-wrap gap-3">{aveugle===null?<button onClick={demarrerAveugle} className="rounded-full bg-ansut-orange px-5 py-2.5 text-sm font-semibold text-white shadow hover:shadow-lg">Casting à l&apos;aveugle (4 finalistes)</button>:<><button onClick={()=>setRevele(true)} disabled={revele} className="rounded-full bg-ansut-blue px-5 py-2.5 text-sm font-semibold text-white shadow disabled:opacity-50">Révéler les voix</button><button onClick={()=>{setAveugle(null);setRevele(false);setStatus("Choisissez une voix : toutes lisent exactement le même texte.");}} className="rounded-full border border-ansut-border bg-white px-5 py-2.5 text-sm font-semibold">Quitter l&apos;aveugle</button></>}</div>
    {aveugle===null
      ?<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{VOICES.map(({name,note})=><button key={name} onClick={()=>audition(name)} className={`rounded-3xl border p-5 text-left transition hover:-translate-y-1 hover:shadow-lg ${active===name?"border-ansut-orange bg-white shadow-lg":"border-ansut-border bg-white/70"}`}><span className="text-xs font-bold uppercase tracking-widest text-ansut-orange">{note}</span><strong className="mt-2 block text-2xl capitalize">{name}</strong><span className="mt-4 inline-block rounded-full bg-ansut-blue px-4 py-2 text-xs font-semibold text-white">Écouter</span></button>)}</div>
      :<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{aveugle.map((voice,i)=><button key={LETTRES[i]} onClick={()=>audition(voice,`Voix ${LETTRES[i]}`)} className={`rounded-3xl border p-6 text-left transition hover:-translate-y-1 hover:shadow-lg ${active===voice?"border-ansut-orange bg-white shadow-lg":"border-ansut-border bg-white/70"}`}><strong className="block text-3xl">Voix {LETTRES[i]}</strong>{revele&&<span className="mt-1 block text-sm capitalize text-ansut-text-muted">{voice}</span>}<span className="mt-4 inline-block rounded-full bg-ansut-blue px-4 py-2 text-xs font-semibold text-white">Écouter</span></button>)}</div>}
    <section className="mt-8 rounded-3xl border border-ansut-border bg-white p-6"><h2 className="font-semibold">Phrase témoin</h2><p className="mt-3 leading-7 text-ansut-text-muted">{SCRIPT}</p></section><p className="mt-5 text-sm font-medium">{status}</p>
    <section className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-white p-4">1. Naturel du français</div><div className="rounded-2xl bg-white p-4">2. Disparition du fond nord-américain</div><div className="rounded-2xl bg-white p-4">3. Crédibilité institutionnelle</div><div className="rounded-2xl bg-white p-4">4. Prononciation : Korhogo, Sinématiali, Djacé (et ANSUT, SUTA)</div></section>
    <p className="mt-4 text-sm text-ansut-text-muted">Si aucune voix ne passe le critère d&apos;appartenance, la limite du fournisseur est établie — le signal pour envisager une voix native francophone africaine externe.</p></div></main>;
}
