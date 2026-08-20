"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push("/admin");
        router.refresh();
        return;
      }

      const body = await response.json().catch(() => ({}));
      setError(
        response.status === 503
          ? "L'administration n'est pas configurée sur cet environnement."
          : (body.error ?? "Mot de passe incorrect."),
      );
    } catch {
      setError("Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-brand-background px-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white/5 p-8"
      >
        <h1 className="text-center text-lg font-semibold text-brand-text">
          Administration SUTA
        </h1>
        <label htmlFor="admin-password" className="sr-only">
          Mot de passe administrateur
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mot de passe"
          autoFocus
          className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-brand-text placeholder:text-brand-text/40 focus:border-brand-secondary focus:outline-none"
        />
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="rounded-full bg-brand-secondary px-5 py-3 text-sm font-medium text-brand-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
