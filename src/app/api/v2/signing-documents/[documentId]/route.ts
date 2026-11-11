import { apiRoute } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getSigningDocument } from "@/server/signing/queries";
export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return apiRoute(async () => {
    const document = await getSigningDocument(
      (await context.params).documentId,
    );
    if (!document)
      throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
    return document;
  });
}
