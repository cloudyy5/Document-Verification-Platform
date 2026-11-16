import { apiRoute } from "@/server/api";
import { getArchiveOverview } from "@/server/archive";
export async function GET() {
  return apiRoute(getArchiveOverview);
}
