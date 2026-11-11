import { describe, expect, it } from "vitest";
import {
  isCalendarDate,
  parseSubmissionFields,
  profileSchema,
  submissionSchema,
} from "@/lib/documents/validation";

const policy = "development-2026-11-04";
const categoryId = "40000000-0000-4000-8000-000000000001";

function form(extra: Record<string, string | undefined> = {}) {
  const result = new FormData();
  for (const [field, value] of Object.entries({
    title: "  Synthetic document  ",
    categoryId,
    policyVersion: policy,
    consent: "true",
    ...extra,
  }))
    if (value !== undefined) result.set(field, value);
  return result;
}

describe("submission metadata and consent validation", () => {
  it("normalizes optional blanks and retains the explicitly accepted policy", () => {
    expect(parseSubmissionFields(form(), policy, false)).toEqual({
      title: "Synthetic document",
      categoryId,
      customDocumentType: null,
      documentDate: null,
      issuingInstitution: null,
      description: null,
      policyVersion: policy,
      consent: true,
    });
  });

  it.each(["false", "on", "1", "TRUE", "", "yes"])(
    "requires consent exactly true rather than truthy text",
    (consent) => {
      expect(() =>
        parseSubmissionFields(form({ consent }), policy, false),
      ).toThrow();
    },
  );

  it("requires a fresh policy acceptance instead of silently upgrading consent", () => {
    expect(() =>
      parseSubmissionFields(
        form({ policyVersion: "previous-policy" }),
        policy,
        false,
      ),
    ).toThrow();
  });

  it("requires the custom type for Lainnya and does not retain it for another category", () => {
    expect(() => parseSubmissionFields(form(), policy, true)).toThrow();
    expect(
      parseSubmissionFields(
        form({ customDocumentType: "  Synthetic type  " }),
        policy,
        true,
      ).customDocumentType,
    ).toBe("Synthetic type");
    expect(() =>
      parseSubmissionFields(
        form({ customDocumentType: "Synthetic type" }),
        policy,
        false,
      ),
    ).toThrow();
  });

  it.each([
    "owner_id",
    "reviewer_id",
    "role",
    "roles",
    "sha256",
    "storage_path",
    "consented_at",
    "status",
    "versionNo",
  ])("rejects browser-supplied privileged field %s", (field) => {
    expect(() =>
      parseSubmissionFields(form({ [field]: "forged" }), policy, false),
    ).toThrow();
  });

  it.each(["title", "categoryId", "consent", "policyVersion", "file"])(
    "rejects duplicated multipart field %s",
    (field) => {
      const values = form();
      values.append(field, "first");
      values.append(field, "second");
      expect(() => parseSubmissionFields(values, policy, false)).toThrow();
    },
  );

  it.each([
    { title: " " },
    { title: "a".repeat(201) },
    { categoryId: "not-a-uuid" },
    { description: "a".repeat(2001) },
    { issuingInstitution: "a".repeat(201) },
    { customDocumentType: "a".repeat(121) },
  ])("rejects invalid metadata boundaries", (fields) => {
    expect(() => parseSubmissionFields(form(fields), policy, false)).toThrow();
  });

  it.each([
    "2026-02-30",
    "2026-02-29",
    "2026-13-01",
    "0000-01-01",
    "04/11/2026",
    "2026-1-01",
  ])("rejects invalid calendar date %s", (documentDate) => {
    expect(isCalendarDate(documentDate)).toBe(false);
    expect(() =>
      parseSubmissionFields(form({ documentDate }), policy, false),
    ).toThrow();
  });

  it("accepts a leap date and optional empty date without inventing a future-date policy", () => {
    expect(isCalendarDate("2028-02-29")).toBe(true);
    expect(
      parseSubmissionFields(form({ documentDate: "2028-02-29" }), policy, false)
        .documentDate,
    ).toBe("2028-02-29");
  });

  it("rejects File values in scalar metadata and non-boolean schema consent", () => {
    const values = form();
    values.set("title", new File(["synthetic"], "synthetic.txt"));
    expect(() => parseSubmissionFields(values, policy, false)).toThrow();
    expect(
      submissionSchema.safeParse({
        title: "Synthetic",
        categoryId,
        consent: "true",
        policyVersion: policy,
      }).success,
    ).toBe(false);
  });
});

describe("profile field allowlist", () => {
  it("distinguishes an omitted phone from an explicit clear", () => {
    expect(
      profileSchema.parse({ fullName: "Synthetic owner" }).phone,
    ).toBeUndefined();
    expect(
      profileSchema.parse({ fullName: "Synthetic owner", phone: null }).phone,
    ).toBeNull();
  });

  it("normalizes only editable name and phone", () => {
    expect(
      profileSchema.parse({ fullName: "  Synthetic owner  ", phone: " " }),
    ).toEqual({ fullName: "Synthetic owner", phone: null });
  });

  it.each(["email", "role", "roles", "owner_id", "accountStatus"])(
    "rejects profile privilege field %s",
    (field) => {
      expect(
        profileSchema.safeParse({ fullName: "Synthetic", [field]: "forged" })
          .success,
      ).toBe(false);
    },
  );

  it.each([
    { fullName: " " },
    { fullName: "a".repeat(121) },
    { fullName: "Synthetic", phone: "1".repeat(41) },
  ])("rejects invalid profile lengths", (input) => {
    expect(profileSchema.safeParse(input).success).toBe(false);
  });
});
