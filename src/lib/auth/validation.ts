import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email("Masukkan alamat email yang valid."));
const password = z
  .string()
  .min(8, "Gunakan sedikitnya 8 karakter.")
  .max(128, "Gunakan paling banyak 128 karakter.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Masukkan password Anda.").max(128),
});
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Masukkan nama lengkap Anda.")
      .max(120, "Nama paling banyak 120 karakter."),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi password belum sesuai.",
    path: ["confirmPassword"],
  });
export const emailSchema = z.object({ email });
export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Konfirmasi password belum sesuai.",
    path: ["confirmPassword"],
  });

/** Ignore extra identity/role fields: authentication never trusts browser roles. */
export function authFields(form: FormData) {
  return {
    email: form.get("email"),
    fullName: form.get("fullName"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  };
}
