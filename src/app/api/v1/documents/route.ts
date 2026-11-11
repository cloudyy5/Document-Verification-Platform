import { apiRoute } from "@/server/api";
import { getWorkspaceDocuments } from "@/server/workspace/queries";
import { uploadSubmission } from "@/server/documents/upload";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return apiRoute(() =>
    getWorkspaceDocuments(
      Object.fromEntries(new URL(request.url).searchParams),
    ),
  );
}
export async function POST(request: Request) {
  return apiRoute(() => uploadSubmission(request), 201);
}
