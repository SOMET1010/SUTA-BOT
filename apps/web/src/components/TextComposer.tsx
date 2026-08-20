"use client";

import { useState, type FormEvent } from "react";

export function TextComposer({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-2xl gap-2">
      <label htmlFor="suta-text-input" className="sr-only">
        Écrire un message à SUTA
      </label>
      <input
        id="suta-text-input"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        placeholder="Ou écrivez votre question ici..."
        className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-brand-text placeholder:text-brand-text/40 focus:border-brand-secondary focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={disabled || value.trim().length === 0}
        className="rounded-full bg-brand-secondary px-5 py-3 text-sm font-medium text-brand-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Envoyer
      </button>
    </form>
  );
}
