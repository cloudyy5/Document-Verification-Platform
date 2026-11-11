import { apiRoute } from "@/server/api";
import { serveDocumentFile } from "@/server/documents/file";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return apiRoute(async () =>
    serveDocumentFile(request, (await context.params).documentId),
  );
}
