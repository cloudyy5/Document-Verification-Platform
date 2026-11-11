import { z } from "zod";

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1)
    return false;
  try {
    return (
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
    );
  } catch {
    return false;
  }
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || null);
export const submissionSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, "Nama dokumen wajib diisi.")
    .max(200, "Nama dokumen maksimal 200 karakter."),
  categoryId: z.uuid("Pilih kategori dokumen yang tersedia."),
  customDocumentType: optionalText(120),
  documentDate: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || isCalendarDate(value),
      "Tanggal dokumen tidak valid.",
    )
    .transform((value) => value || null),
  issuingInstitution: optionalText(200),
  description: optionalText(2000),
  policyVersion: z.string().trim().min(1).max(100),
  consent: z.literal(true, "Persetujuan kebijakan wajib diberikan."),
});

export const profileSchema = z.strictObject({
  fullName: z
    .string()
    .trim()
    .min(1, "Nama lengkap wajib diisi.")
    .max(120, "Nama maksimal 120 karakter."),
  phone: z
    .string()
    .trim()
    .max(40, "Nomor telepon maksimal 40 karakter.")
    .nullish()
    .transform((value) => (value === undefined ? undefined : value || null)),
});

export type SubmissionMetadata = z.infer<typeof submissionSchema>;
export const submissionFields = [
  "title",
  "categoryId",
  "customDocumentType",
  "documentDate",
  "issuingInstitution",
  "description",
  "policyVersion",
  "consent",
] as const;

export function parseSubmissionFields(
  form: FormData,
  currentPolicyVersion: string,
  categoryIsOther: boolean,
): SubmissionMetadata {
  const allowed = new Set<string>([...submissionFields, "file"]);
  if (
    [...form.keys()].some((field) => !allowed.has(field)) ||
    [...allowed].some((field) => form.getAll(field).length > 1)
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: [],
        message: "Field pengajuan tidak valid atau dikirim berulang.",
      },
    ]);
  }
  const values = Object.fromEntries(
    submissionFields.map((field) => [
      field,
      field === "consent"
        ? form.get(field) === "true"
        : (form.get(field) ?? ""),
    ]),
  );
  const result = submissionSchema.parse(values);
  const issues: z.core.$ZodIssue[] = [];
  if (result.policyVersion !== currentPolicyVersion)
    issues.push({
      code: "custom",
      path: ["policyVersion"],
      message:
        "Kebijakan telah berubah. Muat ulang formulir dan berikan persetujuan kembali.",
    });
  if (categoryIsOther && !result.customDocumentType)
    issues.push({
      code: "custom",
      path: ["customDocumentType"],
      message: "Isi jenis dokumen untuk kategori Lainnya.",
    });
  if (!categoryIsOther && result.customDocumentType)
    issues.push({
      code: "custom",
      path: ["customDocumentType"],
      message: "Jenis dokumen khusus hanya digunakan pada kategori Lainnya.",
    });
  if (issues.length) throw new z.ZodError(issues);
  return result;
}
