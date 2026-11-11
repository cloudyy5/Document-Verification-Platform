"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiSession, assertMutationOrigin } from "@/server/api";
import { profileSchema } from "@/lib/documents/validation";
import {
  updateWorkspaceProfile,
  WorkspaceValidationError,
} from "@/server/workspace/queries";
import type { ProfileActionState } from "@/server/workspace/types";

export async function updateProfileAction(
  _previous: ProfileActionState,
  form: FormData,
): Promise<ProfileActionState> {
  try {
    await apiSession();
    assertMutationOrigin((await headers()).get("origin"));
    const values = Object.fromEntries(
      [...form.entries()].filter(([key]) => !key.startsWith("$ACTION_")),
    );
    if ([...form.keys()].some((key) => form.getAll(key).length > 1))
      return { status: "error", message: "Data profil tidak valid." };
    const result = profileSchema.parse(values);
    await updateWorkspaceProfile(result);
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: "Perubahan profil berhasil disimpan.",
    };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        status: "error",
        message: "Periksa kembali data profil.",
        fieldErrors: Object.fromEntries(
          error.issues
            .filter(
              (issue) =>
                issue.path[0] === "fullName" || issue.path[0] === "phone",
            )
            .map((issue) => [issue.path[0], issue.message]),
        ),
      };
    if (error instanceof WorkspaceValidationError)
      return {
        status: "error",
        message: error.message,
        fieldErrors: error.fieldErrors,
      };
    return {
      status: "error",
      message: "Profil belum dapat disimpan. Periksa sesi dan coba kembali.",
    };
  }
}
