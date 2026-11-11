import { apiRoute } from "@/server/api";
import { getWorkspaceDashboard } from "@/server/workspace/queries";
export async function GET() {
  return apiRoute(getWorkspaceDashboard);
}
