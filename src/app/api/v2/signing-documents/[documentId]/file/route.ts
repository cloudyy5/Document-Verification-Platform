import { apiRoute } from "@/server/api";
import { serveSigningFile } from "@/server/signing/file";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return apiRoute(async () =>
    serveSigningFile(request, (await context.params).documentId),
  );
}
