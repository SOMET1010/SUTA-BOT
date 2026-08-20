import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { hasValidAdminSession } from "@/lib/admin-auth";

const CARDS = [
  {
    href: "/admin/knowledge",
    title: "Base de connaissances",
    description: "Documents, ingestion, réindexation, test d'une question.",
  },
  {
    href: "/admin/diagnostics",
    title: "Diagnostics",
    description: "État des services (Realtime, base de données, embeddings).",
  },
  {
    href: "/admin/settings",
    title: "Paramètres",
    description: "Configuration en lecture seule (aucun secret affiché).",
  },
];

export default async function AdminDashboardPage() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }

  return (
    <AdminShell title="Tableau de bord">
      <div className="grid gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors hover:border-brand-secondary"
          >
            <h2 className="mb-1 font-medium text-brand-text">{card.title}</h2>
            <p className="text-sm text-brand-text/60">{card.description}</p>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
