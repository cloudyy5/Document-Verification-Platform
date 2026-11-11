import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SigningRequestDetail } from "@/features/signing/request-detail";
import { SigningUnavailable } from "@/features/signing/states";
import { requireUserWorkspace } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { getSigningRequest } from "@/server/signing/queries";

export const metadata: Metadata = { title: "Detail permintaan" };

export default async function RequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  await requireUserWorkspace(`/requests/${requestId}`);
  let detail: Awaited<ReturnType<typeof getSigningRequest>>;
  try {
    detail = await getSigningRequest(requestId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Detail permintaan" />;
  }
  if (!detail) notFound();
  return (
    <SigningRequestDetail
      key={detail.request.id}
      request={detail.request}
      document={detail.document}
    />
  );
}
