import { PlaceholderPage } from "@/features/foundation/placeholder-page";
import { requireReviewer } from "@/lib/auth/session";

export default async function ReviewQueuePage() {
  await requireReviewer("/admin/review-queue");
  return (
    <PlaceholderPage
      admin
      title="Antrean review"
      description="Ruang pemeriksaan pengajuan untuk reviewer berwenang."
      phase="Phase 4 — Administrative Review"
    />
  );
}
