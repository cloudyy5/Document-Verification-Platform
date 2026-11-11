import { PlaceholderPage } from "@/features/foundation/placeholder-page";
import { requireReviewer } from "@/lib/auth/session";

export default async function ReviewHistoryPage() {
  await requireReviewer("/admin/review-history");
  return (
    <PlaceholderPage
      admin
      title="Riwayat review"
      description="Jejak keputusan administratif dan catatan pemeriksaan."
      phase="Phase 4 — Administrative Review"
    />
  );
}
