import { apiRoute } from "@/server/api";
import { uploadSubmission } from "@/server/documents/upload";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return apiRoute(
    async () => uploadSubmission(request, (await context.params).documentId),
    201,
  );
}
