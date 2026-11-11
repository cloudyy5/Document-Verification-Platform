import { apiRoute } from "@/server/api";
import { getWorkspaceCategories } from "@/server/workspace/queries";
export async function GET() {
  return apiRoute(getWorkspaceCategories);
}
