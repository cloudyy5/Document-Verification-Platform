import { apiRoute } from "@/server/api";
import { getSigningUserCode } from "@/server/signing/queries";
export async function GET() {
  return apiRoute(getSigningUserCode);
}
