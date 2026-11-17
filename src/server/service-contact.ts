import "server-only";
import { z } from "zod";
export function getPublicServiceContact() {
  const result = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      email: z.email().max(254).optional(),
    })
    .safeParse({
      name: process.env.SERVICE_OPERATOR_NAME?.trim() || "KPILKOMITH",
      email:
        process.env.SERVICE_SUPPORT_EMAIL?.trim() || "kp.ilkomith@gmail.com",
    });
  return result.success ? result.data : null;
}
