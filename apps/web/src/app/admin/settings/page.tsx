import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { hasValidAdminSession } from "@/lib/admin-auth";

const APP_VERSION = "0.1.0";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
      <span className="text-brand-text/60">{label}</span>
      <span className="font-medium text-brand-text">{value}</span>
    </div>
  );
}

/**
 * Configuration en lecture seule (cahier des charges, section 43).
 * N'affiche jamais de clé, de secret, de mot de passe ou de chaîne de
 * connexion — uniquement les noms de fournisseurs et paramètres publics.
 */
export default async function AdminSettingsPage() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }

  return (
    <AdminShell title="Paramètres">
      <section className="max-w-xl rounded-2xl border border-white/10 bg-white/5 p-5">
        <Row label="Provider Realtime" value={process.env.AI_PROVIDER || "mock"} />
        <Row label="Deployment Realtime" value={process.env.REALTIME_DEPLOYMENT || "non configuré"} />
        <Row label="Région Azure" value={process.env.AZURE_OPENAI_REGION || "non configurée"} />
        <Row label="Provider d'embeddings" value={process.env.EMBEDDINGS_PROVIDER || "mock"} />
        <Row label="Dimension des embeddings" value={process.env.EMBEDDING_DIMENSIONS || "1536"} />
        <Row label="Base de données" value="PostgreSQL (pgvector)" />
        <Row label="Environnement" value={process.env.APP_ENV || "development"} />
        <Row label="Mode fallback Salon" value={process.env.DEMO_FALLBACK_MODE ?? "true"} />
        <Row label="Version application" value={APP_VERSION} />
      </section>
    </AdminShell>
  );
}
