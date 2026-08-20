import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { KnowledgeManager } from "@/components/admin/KnowledgeManager";
import { TestQuestionPanel } from "@/components/admin/TestQuestionPanel";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { listDocumentsForAdmin } from "@/lib/admin-documents";

export default async function AdminKnowledgePage() {
  if (!(await hasValidAdminSession())) {
    redirect("/admin/login");
  }

  const documents = await listDocumentsForAdmin();

  return (
    <AdminShell title="Base de connaissances">
      <div className="flex flex-col gap-8">
        <KnowledgeManager initialDocuments={documents} />
        <TestQuestionPanel />
      </div>
    </AdminShell>
  );
}
