import type { Metadata } from "next";
import { SubmissionForm } from "@/features/workspace/submission-form";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { getSubmissionConfiguration } from "@/server/documents/config";
import { getWorkspaceCategories } from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Ajukan dokumen" };

export default async function SubmitPage() {
  await requireVerifiedEmail("/submit");
  const configuration = getSubmissionConfiguration();
  const categories = await getWorkspaceCategories();
  return (
    <SubmissionForm categories={categories} configuration={configuration} />
  );
}
