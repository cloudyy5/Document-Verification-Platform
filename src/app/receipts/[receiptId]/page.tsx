import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSigningPublicMetadata } from "@/server/signing/public-metadata";
import {
  PublicMetadataShell,
  PublicSigningMetadataView,
} from "@/features/signing/public-metadata-view";
import { ApiError } from "@/server/errors";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Metadata persetujuan",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};
export default async function PublicReceiptPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  let result;
  try {
    result = await getSigningPublicMetadata(receiptId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <PublicMetadataShell>
        <h1 className="text-2xl font-semibold">Metadata belum tersedia</h1>
        <p
          role="alert"
          className="mt-4 text-sm leading-6 text-muted-foreground"
        >
          {error.message}
        </p>
      </PublicMetadataShell>
    );
  }
  if (!result) notFound();
  return <PublicSigningMetadataView metadata={result} receiptId={receiptId} />;
}
