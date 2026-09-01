"use client";

import { useEffect, useState } from "react";

/**
 * Signalements citoyens (LOT ACTION, démo du 9 septembre) : ce que les
 * citoyens ont signalé à SUTA — localité, catégorie, canal, commentaire
 * purgé des numéros. Anonyme par construction : rien d'autre à protéger
 * que l'accès à la page (session admin).
 */

interface Signalement {
  id: string;
  createdAt: string;
  localite: string;
  localiteReconnue: string | null;
  departement: string | null;
  region: string | null;
  probleme: string;
  commentaire: string | null;
  canal: string;
}

const LIBELLES_PROBLEME: Record<string, string> = {
  pas_de_reseau: "Pas de réseau",
  reseau_instable: "Réseau instable",
  pas_internet: "Pas d'internet",
  autre: "Autre",
};

export default function SignalementsPage() {
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [status, setStatus] = useState("Chargement…");

  useEffect(() => {
    let actif = true;
    fetch("/api/admin/signalements")
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!actif) return;
        if (!r.ok || !Array.isArray(data?.signalements)) {
          setStatus((data as { error?: string } | null)?.error ?? "Lecture indisponible.");
          return;
        }
        setSignalements(data.signalements as Signalement[]);
        setStatus("");
      })
      .catch(() => { if (actif) setStatus("Lecture indisponible."); });
    return () => { actif = false; };
  }, []);

  return (
    <main className="min-h-screen bg-ansut-surface px-6 py-10 text-ansut-blue">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold">Signalements citoyens</h1>
        <p className="mt-1 text-sm text-ansut-text-muted">
          Ce que les citoyens signalent à SUTA — anonyme par construction : localité, catégorie, canal. Les numéros de téléphone sont retirés des commentaires avant enregistrement.
        </p>
        {status && <p className="mt-6 text-sm text-ansut-text-muted">{status}</p>}
        {!status && signalements.length === 0 && (
          <p className="mt-6 text-sm text-ansut-text-muted">Aucun signalement pour le moment.</p>
        )}
        {signalements.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-xl border border-ansut-border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ansut-border text-xs uppercase text-ansut-text-muted">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Localité</th>
                  <th className="px-4 py-3">Région</th>
                  <th className="px-4 py-3">Problème</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {signalements.map((s) => (
                  <tr key={s.id} className="border-b border-ansut-border last:border-b-0">
                    <td className="whitespace-nowrap px-4 py-3 text-ansut-text-muted">
                      {new Date(s.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {s.localiteReconnue ?? s.localite}
                      {!s.localiteReconnue && <span className="ml-1 text-xs text-ansut-orange">(non reconnue)</span>}
                    </td>
                    <td className="px-4 py-3">{s.region ?? "—"}</td>
                    <td className="px-4 py-3">{LIBELLES_PROBLEME[s.probleme] ?? s.probleme}</td>
                    <td className="px-4 py-3">{s.canal}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-ansut-text-muted" title={s.commentaire ?? ""}>
                      {s.commentaire ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
