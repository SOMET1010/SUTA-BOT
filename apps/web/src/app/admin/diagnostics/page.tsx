import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createRealtimeProvider } from "@suta/ai";
import { describeDatabaseHost, prisma } from "@suta/database";
import { createEmbeddingsProvider } from "@suta/knowledge";
import { AdminShell } from "@/components/admin/AdminShell";
import { hasValidAdminSession } from "@/lib/admin-auth";

/**
 * Console de diagnostic (cahier des charges, section 27). Ne vérifie que la
 * *configuration* des fournisseurs (construction sans erreur), pas une
 * connexion live — créer une vraie session Realtime à chaque chargement de
 * cette page gaspillerait du quota et ralentirait inutilement la page.
 * Ne révèle jamais de secret.
 */
async function checkStatus(check: () => unknown | Promise<unknown>): Promise<"ok" | "erreur"> {
  try {
    await check();
    return "ok";
  } catch {
    return "erreur";
  }
}

function StatusBadge({ status }: { status: "ok" | "erreur" }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        status === "ok" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {status === "ok" ? "OK" : "ERREUR"}
    </span>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
      <span className="text-brand-text/60">{label}</span>
      <span className="font-medium text-brand-text">{value}</span>
    </div>
  );
}

export default async function AdminDiagnosticsPage() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }

  const [realtimeStatus, knowledgeStatus, databaseStatus, documentCount, chunkCount, lastIndexed] =
    await Promise.all([
      checkStatus(() => createRealtimeProvider()),
      checkStatus(() => createEmbeddingsProvider()),
      checkStatus(() => prisma.$queryRaw`SELECT 1`),
      prisma.document.count(),
      prisma.documentChunk.count(),
      prisma.document.aggregate({ _max: { indexedAt: true } }),
    ]);

  const fallbackEnabled = (process.env.DEMO_FALLBACK_MODE ?? "true").toLowerCase() === "true";

  return (
    <AdminShell title="Diagnostics">
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 font-medium">Services</h2>
          <Row
            label="Realtime provider"
            value={
              <span className="flex items-center gap-2">
                {process.env.AI_PROVIDER || "mock"} <StatusBadge status={realtimeStatus} />
              </span>
            }
          />
          <Row label="Realtime model" value={process.env.REALTIME_MODEL || "non configuré"} />
          <Row label="Realtime deployment" value={process.env.REALTIME_DEPLOYMENT || "non configuré"} />
          <Row
            label="Fallback Salon (DEMO_FALLBACK_MODE)"
            value={fallbackEnabled ? "activé" : "désactivé"}
          />
          <Row
            label="Base de données"
            value={<StatusBadge status={databaseStatus} />}
          />
          {/* Le serveur, jamais l'utilisateur ni le mot de passe : savoir sur
              quelle base tourne réellement l'application est indispensable au
              diagnostic, et cette valeur n'est pas relisible depuis Vercel
              (variable marquée « Sensitive »). */}
          <Row label="Serveur" value={describeDatabaseHost(process.env.DATABASE_URL)} />
          <Row
            label="Index de connaissances"
            value={
              <span className="flex items-center gap-2">
                {process.env.EMBEDDINGS_PROVIDER || "mock"} <StatusBadge status={knowledgeStatus} />
              </span>
            }
          />
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-3 font-medium">Base de connaissances</h2>
          <Row label="Documents" value={documentCount} />
          <Row label="Fragments (chunks)" value={chunkCount} />
          <Row
            label="Dernière indexation"
            value={
              lastIndexed._max.indexedAt
                ? new Date(lastIndexed._max.indexedAt).toLocaleString("fr-FR")
                : "jamais"
            }
          />
        </section>
      </div>
    </AdminShell>
  );
}
