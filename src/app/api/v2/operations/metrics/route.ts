import { apiRoute } from "@/server/api";
import { getOperationsSnapshot } from "@/server/operations/queries";
export async function GET(request: Request) {
  return apiRoute(() =>
    getOperationsSnapshot(new URL(request.url).searchParams),
  );
}
