import type { Metadata } from "next";
import { SigningDraftForm } from "@/features/signing/draft-form";
import { SigningUnavailable } from "@/features/signing/states";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { getSigningConfiguration } from "@/server/signing/config";
import { getSigningUserCode } from "@/server/signing/queries";
import { getWorkspaceCategories } from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Buat draft privat" };

export default async function NewSigningDocumentPage() {
  await requireVerifiedEmail("/signing/new");
  let data: {
    categories: Awaited<ReturnType<typeof getWorkspaceCategories>>;
    maxBytes: number;
  };
  try {
    const configuration = getSigningConfiguration();
    const [categories] = await Promise.all([
      getWorkspaceCategories(),
      getSigningUserCode(),
    ]);
    data = { categories, maxBytes: configuration.maxBytes };
  } catch {
    return <SigningUnavailable title="Buat draft privat" />;
  }
  return (
    <SigningDraftForm categories={data.categories} maxBytes={data.maxBytes} />
  );
}
