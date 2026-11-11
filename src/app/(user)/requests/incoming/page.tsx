import type { Metadata } from "next";
import { SigningRequestsList } from "@/features/signing/request-list";
import { SigningUnavailable } from "@/features/signing/states";
import { requireUserWorkspace } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { getSigningRequests } from "@/server/signing/queries";

export const metadata: Metadata = { title: "Permintaan masuk" };

export default async function IncomingRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserWorkspace("/requests/incoming");
  const input = await searchParams;
  const cursor = typeof input.cursor === "string" ? input.cursor : undefined;
  let result: Awaited<ReturnType<typeof getSigningRequests>>;
  try {
    result = await getSigningRequests({
      scope: "received",
      ...(cursor ? { cursor } : {}),
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Permintaan masuk" />;
  }
  return (
    <SigningRequestsList
      result={result}
      scope="received"
      hasCursor={Boolean(cursor)}
    />
  );
}
