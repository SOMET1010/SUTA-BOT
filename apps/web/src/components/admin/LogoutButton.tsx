"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-brand-text/70 transition-colors hover:border-brand-secondary hover:text-brand-text disabled:opacity-40"
    >
      Se déconnecter
    </button>
  );
}
