import { apiRoute } from "@/server/api";
import { getSigningDocuments } from "@/server/signing/queries";
import { uploadSigningDraft } from "@/server/signing/upload";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return apiRoute(() =>
    getSigningDocuments(Object.fromEntries(new URL(request.url).searchParams)),
  );
}
export async function POST(request: Request) {
  return apiRoute(() => uploadSigningDraft(request), 201);
}
