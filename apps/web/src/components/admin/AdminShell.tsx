import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

const NAV_ITEMS = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/knowledge", label: "Base de connaissances" },
  { href: "/admin/voice-lab", label: "Labo voix" },
  { href: "/admin/voice-casting", label: "Casting" },
  { href: "/admin/diagnostics", label: "Diagnostics" },
  { href: "/admin/settings", label: "Paramètres" },
];

export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-brand-background text-brand-text">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-text/70">
            SUTA — Administration
          </span>
          <nav className="flex gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-brand-text/60 transition-colors hover:text-brand-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <LogoutButton />
      </header>
      <main className="flex-1 px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold">{title}</h1>
        {children}
      </main>
    </div>
  );
}
