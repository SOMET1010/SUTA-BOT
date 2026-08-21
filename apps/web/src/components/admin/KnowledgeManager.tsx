"use client";

import { useCallback, useState, type FormEvent } from "react";
import type { AdminDocumentSummary } from "@/lib/admin-documents";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En cours",
  INDEXED: "Indexé",
  FAILED: "Échec",
};

export function KnowledgeManager({
  initialDocuments,
}: {
  initialDocuments: AdminDocumentSummary[];
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reindexPending, setReindexPending] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refreshDocuments = useCallback(async () => {
    const response = await fetch("/api/admin/documents");
    if (response.ok) {
      const body = await response.json();
      setDocuments(body.documents);
    }
  }, []);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploadPending(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/admin/documents", {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setUploadError(body.error ?? "Échec de l'ingestion.");
        return;
      }

      form.reset();
      await refreshDocuments();
    } catch {
      setUploadError("Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
    } finally {
      setUploadPending(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/admin/documents/${id}`, { method: "DELETE" });
      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleReindex() {
    setReindexPending(true);
    setReindexMessage(null);
    try {
      const response = await fetch("/api/admin/reindex", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      setReindexMessage(
        response.ok
          ? `${body.chunkCount} fragment(s) réindexé(s).`
          : (body.error ?? "Échec de la réindexation."),
      );
    } catch {
      setReindexMessage("Je rencontre momentanément une difficulté technique. Vous pouvez réessayer.");
    } finally {
      setReindexPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-medium">Ajouter un document</h2>
        <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-file" className="text-xs text-brand-text/60">
              Fichier (PDF, DOCX, TXT, MD)
            </label>
            <input
              id="upload-file"
              name="file"
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown,.xlsx,.xls,.csv,.pptx"
              required
              className="text-sm text-brand-text/80 file:mr-3 file:rounded-full file:border-0 file:bg-brand-secondary file:px-4 file:py-2 file:text-sm file:text-brand-background"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="upload-title" className="text-xs text-brand-text/60">
              Titre (optionnel)
            </label>
            <input
              id="upload-title"
              name="title"
              type="text"
              placeholder="Nom du document"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-brand-text placeholder:text-brand-text/40 focus:border-brand-secondary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={uploadPending}
            className="rounded-full bg-brand-secondary px-5 py-2 text-sm font-medium text-brand-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {uploadPending ? "Ingestion..." : "Ingérer"}
          </button>
        </form>
        {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Documents ({documents.length})</h2>
          <div className="flex items-center gap-3">
            {reindexMessage && <span className="text-xs text-brand-text/60">{reindexMessage}</span>}
            <button
              type="button"
              onClick={handleReindex}
              disabled={reindexPending}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-brand-text/80 transition-colors hover:border-brand-secondary disabled:opacity-40"
            >
              {reindexPending ? "Réindexation..." : "Réindexer tout"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-brand-text/50">
              <tr>
                <th className="px-4 py-2">Titre</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Visibilité</th>
                <th className="px-4 py-2">Statut</th>
                <th className="px-4 py-2">Fragments</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-brand-text/50">
                    Aucun document indexé.
                  </td>
                </tr>
              )}
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t border-white/5">
                  <td className="px-4 py-2">{doc.title}</td>
                  <td className="px-4 py-2 text-brand-text/60">{doc.sourceType}</td>
                  <td className="px-4 py-2 text-brand-text/60">{doc.visibility}</td>
                  <td className="px-4 py-2 text-brand-text/60">
                    {STATUS_LABELS[doc.status] ?? doc.status}
                  </td>
                  <td className="px-4 py-2 text-brand-text/60">{doc.chunkCount}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40"
                    >
                      {deletingId === doc.id ? "Suppression..." : "Supprimer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
