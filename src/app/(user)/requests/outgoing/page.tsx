import type { Metadata } from "next";
import { SigningRequestsList } from "@/features/signing/request-list";
import { SigningUnavailable } from "@/features/signing/states";
import { requireUserWorkspace } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { getSigningRequests } from "@/server/signing/queries";

export const metadata: Metadata = { title: "Permintaan terkirim" };

export default async function OutgoingRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserWorkspace("/requests/outgoing");
  const input = await searchParams;
  const cursor = typeof input.cursor === "string" ? input.cursor : undefined;
  let result: Awaited<ReturnType<typeof getSigningRequests>>;
  try {
    result = await getSigningRequests({
      scope: "sent",
      ...(cursor ? { cursor } : {}),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Permintaan terkirim" />;
  }
  return (
    <SigningRequestsList
      result={result}
      scope="sent"
      hasCursor={Boolean(cursor)}
    />
  );
}
