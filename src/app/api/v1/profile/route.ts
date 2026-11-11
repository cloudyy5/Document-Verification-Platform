import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { ApiError } from "@/server/errors";
import { profileSchema } from "@/lib/documents/validation";
import { updateWorkspaceProfile } from "@/server/workspace/queries";

export async function PATCH(request: Request) {
  return apiRoute(async () => {
    await apiSession();
    assertMutationOrigin(request.headers.get("origin"));
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new ApiError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Gunakan data profil JSON.",
      );
    // Bound JSON before parsing, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader)
      throw new ApiError(400, "INVALID_REQUEST", "Data profil tidak tersedia.");
    let text = "";
    let total = 0;
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 4096) {
          await reader.cancel();
          throw new ApiError(
            413,
            "REQUEST_TOO_LARGE",
            "Data profil melebihi batas.",
          );
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError(
        400,
        "INVALID_REQUEST",
        "Data profil tidak dapat dibaca.",
      );
    }
    return updateWorkspaceProfile(profileSchema.parse(body));
  });
}
