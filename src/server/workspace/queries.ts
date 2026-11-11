import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthSession, type AuthSession } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ApiError } from "@/server/errors";
import { assertUserWorkspaceAccess } from "@/server/workspace-access";
import {
  documentStatusSchema,
  mapDocumentSummary,
  mapReview,
  mapSubmissionVersion,
  mapWorkspaceCounts,
  reviewRowSchema,
  summaryRowSchema,
  versionRowSchema,
} from "./mappers";
import type {
  Category,
  DashboardData,
  DocumentDetail,
  DocumentListResult,
  ProfileDTO,
} from "./types";

export class WorkspaceAccessError extends Error {
  readonly status = 401;
  readonly code = "UNAUTHENTICATED";
  constructor() {
    super("Silakan masuk untuk melanjutkan.");
    this.name = "WorkspaceAccessError";
  }
}
export class WorkspaceAvailabilityError extends Error {
  readonly status = 503;
  readonly code = "WORKSPACE_UNAVAILABLE";
  constructor() {
    super("Data workspace sementara tidak tersedia. Silakan coba kembali.");
    this.name = "WorkspaceAvailabilityError";
  }
}
export class WorkspaceValidationError extends Error {
  readonly status = 422;
  readonly code = "VALIDATION_ERROR";
  readonly fieldErrors: Record<string, string>;
  readonly fields: { field: string; message: string }[];
  constructor(error: z.ZodError) {
    super("Periksa kembali data yang dikirim.");
    this.name = "WorkspaceValidationError";
    this.fields = error.issues.map((issue) => ({
      field: String(issue.path[0] ?? "form"),
      message: "Nilai tidak valid.",
    }));
    this.fieldErrors = Object.fromEntries(
      this.fields.map(({ field, message }) => [field, message]),
    );
  }
}

type OwnerContext = { session: AuthSession; client: SupabaseClient<Database> };
async function withOwner<T>(
  run: (context: OwnerContext) => Promise<T>,
  scope: "user" | "account" = "user",
): Promise<T> {
  try {
    const session = await getAuthSession();
    if (!session) throw new WorkspaceAccessError();
    if (scope === "user") assertUserWorkspaceAccess(session);
    const client = await createSupabaseServerClient();
    return await run({ session, client });
  } catch (error) {
    if (
      error instanceof ApiError ||
      error instanceof WorkspaceAccessError ||
      error instanceof WorkspaceValidationError ||
      error instanceof WorkspaceAvailabilityError
    )
      throw error;
    throw new WorkspaceAvailabilityError();
  }
}

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number(value.slice(0, 4)) > 0 &&
      !Number.isNaN(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  });
const optional = (value: unknown) => (value === "" ? undefined : value);
const filterSchema = z
  .object({
    q: z.preprocess(optional, z.string().trim().max(200).optional()),
    status: z.preprocess(optional, documentStatusSchema.optional()),
    categoryId: z.preprocess(optional, z.uuid().optional()),
    from: z.preprocess(optional, calendarDate.optional()),
    to: z.preprocess(optional, calendarDate.optional()),
    cursor: z.preprocess(
      optional,
      z
        .string()
        .max(512)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    ),
    limit: z.preprocess(
      optional,
      z
        .union([
          z.number(),
          z
            .string()
            .regex(/^\d{1,2}$/)
            .transform(Number),
        ])
        .pipe(z.number().int().min(1).max(50))
        .optional(),
    ),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Khoảng ngày không hợp lệ.",
  });
const cursorSchema = z
  .object({
    submittedAt: z.iso.datetime({ offset: true }).max(40),
    id: z.uuid(),
  })
  .strict();

const summaryFields =
  "id,owner_id,current_version_no,current_status,created_at,updated_at,registered_at,revoked_at,revocation_reason,submission_id,title,category_id,submitted_at,category_name,category_slug";

function parseFilters(value: unknown) {
  const parsed = filterSchema.safeParse(value);
  if (!parsed.success) throw new WorkspaceValidationError(parsed.error);
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (parsed.data.cursor) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(
        Buffer.from(parsed.data.cursor, "base64url").toString("utf8"),
      );
    } catch {
      decoded = null;
    }
    const result = cursorSchema.safeParse(decoded);
    if (!result.success)
      throw new WorkspaceValidationError(
        new z.ZodError([
          { code: "custom", path: ["cursor"], message: "Cursor tidak valid." },
        ]),
      );
    cursor = result.data;
  }
  return { ...parsed.data, limit: parsed.data.limit ?? 20, after: cursor };
}

async function readDocuments(
  { client, session }: OwnerContext,
  input: unknown,
): Promise<DocumentListResult> {
  const filters = parseFilters(input);
  let query = client
    .from("workspace_documents")
    .select(summaryFields)
    .eq("owner_id", session.user.id)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(filters.limit + 1);
  if (filters.q)
    query = query.ilike("title", `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (filters.status) query = query.eq("current_status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.from)
    query = query.gte("submitted_at", `${filters.from}T00:00:00.000000Z`);
  if (filters.to)
    query = query.lte("submitted_at", `${filters.to}T23:59:59.999999Z`);
  if (filters.after) {
    const { submittedAt, id } = filters.after;
    query = query.or(
      `submitted_at.lt.${submittedAt},and(submitted_at.eq.${submittedAt},id.lt.${id})`,
    );
  }
  const { data, error } = await query;
  if (error || !data) throw new WorkspaceAvailabilityError();
  const rows = z.array(summaryRowSchema).parse(data);
  // RLS + view owner scope + explicit predicate are deliberately independent checks.
  if (rows.some((row) => row.owner_id !== session.user.id))
    throw new WorkspaceAvailabilityError();
  const page = rows.slice(0, filters.limit);
  const last = page.at(-1);
  return {
    items: page.map(mapDocumentSummary),
    limit: filters.limit,
    nextCursor:
      rows.length > filters.limit && last
        ? Buffer.from(
            JSON.stringify({ submittedAt: last.submitted_at, id: last.id }),
          ).toString("base64url")
        : null,
  };
}

export async function getWorkspaceDocuments(
  input: unknown = {},
): Promise<DocumentListResult> {
  return withOwner((context) => readDocuments(context, input));
}
export async function getWorkspaceDashboard(): Promise<DashboardData> {
  return withOwner(async (context) => {
    const [countsResult, recent] = await Promise.all([
      context.client.rpc("get_own_workspace_counts"),
      readDocuments(context, { limit: 5 }),
    ]);
    if (countsResult.error || countsResult.data === null)
      throw new WorkspaceAvailabilityError();
    return {
      counts: mapWorkspaceCounts(countsResult.data),
      recentDocuments: recent.items,
    };
  });
}

export async function getWorkspaceCategories(): Promise<Category[]> {
  return withOwner(async ({ client }) => {
    const { data, error } = await client
      .from("document_categories")
      .select("id,name,slug")
      .eq("is_active", true)
      .order("display_order")
      .order("id");
    if (error || !data) throw new WorkspaceAvailabilityError();
    return data;
  });
}

export async function getWorkspaceDocument(
  documentId: string,
): Promise<DocumentDetail | null> {
  return withOwner(async ({ client, session }) => {
    if (!z.uuid().safeParse(documentId).success) return null;
    const result = await client
      .from("workspace_documents")
      .select(summaryFields)
      .eq("id", documentId)
      .eq("owner_id", session.user.id)
      .maybeSingle();
    if (result.error) throw new WorkspaceAvailabilityError();
    if (!result.data) return null;
    const summary = summaryRowSchema.parse(result.data);
    if (summary.owner_id !== session.user.id) return null;
    const versionsResult = await client
      .from("document_submissions")
      .select(
        "id,document_id,submitted_by,version_no,status,title,category_id,custom_document_type,document_date,issuing_institution,description,original_filename,file_size_bytes,sha256,submitted_at,policy_version,consented_at",
      )
      .eq("document_id", documentId)
      .eq("submitted_by", session.user.id)
      .order("version_no", { ascending: false });
    if (versionsResult.error || !versionsResult.data)
      throw new WorkspaceAvailabilityError();
    const versionRows = z.array(versionRowSchema).parse(versionsResult.data);
    if (
      !versionRows.length ||
      versionRows.some(
        (row) =>
          row.document_id !== documentId ||
          row.submitted_by !== session.user.id,
      )
    )
      throw new WorkspaceAvailabilityError();
    const ids = versionRows.map((row) => row.id);
    const categoryIds = [...new Set(versionRows.map((row) => row.category_id))];
    const [reviewsResult, categoriesResult] = await Promise.all([
      client
        .from("review_decisions")
        .select("submission_id,decision,checklist,decision_note,created_at")
        .in("submission_id", ids),
      client
        .from("document_categories")
        .select("id,name,slug")
        .in("id", categoryIds),
    ]);
    if (reviewsResult.error || categoriesResult.error)
      throw new WorkspaceAvailabilityError();
    const reviews = new Map(
      z
        .array(reviewRowSchema)
        .parse(reviewsResult.data ?? [])
        .map((row) => [row.submission_id, mapReview(row)]),
    );
    const categories = new Map(
      (categoriesResult.data ?? []).map((row) => [row.id, row]),
    );
    const versions = versionRows.map((row) =>
      mapSubmissionVersion(
        row,
        categories.get(row.category_id) ?? {
          id: row.category_id,
          name: null,
          slug: null,
        },
        reviews.get(row.id) ?? null,
      ),
    );
    const current = versions.find(
      (version) =>
        version.versionNo === summary.current_version_no &&
        version.submissionId === summary.submission_id,
    );
    if (!current) throw new WorkspaceAvailabilityError();
    return {
      ...mapDocumentSummary(summary),
      customDocumentType: current.customDocumentType,
      documentDate: current.documentDate,
      issuingInstitution: current.issuingInstitution,
      description: current.description,
      fileName: current.fileName,
      fileSizeBytes: current.fileSizeBytes,
      sha256: current.sha256,
      policyVersion: current.policyVersion,
      consentedAt: current.consentedAt,
      revokedAt: summary.revoked_at,
      revocationReason: summary.revocation_reason,
      versions,
    };
  });
}

const profileFields = "full_name,phone,created_at";
function mapProfile(
  row: { full_name: string | null; phone: string | null; created_at: string },
  session: AuthSession,
): ProfileDTO {
  return {
    fullName: row.full_name,
    phone: row.phone,
    createdAt: row.created_at,
    email: session.user.email ?? "",
    emailConfirmed: session.user.emailConfirmed,
  };
}
export async function getWorkspaceProfile(): Promise<ProfileDTO> {
  return withOwner(async ({ client, session }) => {
    const { data, error } = await client
      .from("profiles")
      .select(profileFields)
      .eq("id", session.user.id)
      .maybeSingle();
    if (error || !data) throw new WorkspaceAvailabilityError();
    return mapProfile(data, session);
  }, "account");
}
const profileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().max(40).nullable().optional(),
  })
  .strict();
export async function updateWorkspaceProfile(
  input: unknown,
): Promise<ProfileDTO> {
  return withOwner(async ({ client, session }) => {
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) throw new WorkspaceValidationError(parsed.error);
    const updates = {
      full_name: parsed.data.fullName,
      ...(parsed.data.phone !== undefined
        ? { phone: parsed.data.phone || null }
        : {}),
    };
    const { data, error } = await client
      .from("profiles")
      .update(updates)
      .eq("id", session.user.id)
      .select(profileFields)
      .maybeSingle();
    if (error || !data) throw new WorkspaceAvailabilityError();
    return mapProfile(data, session);
  }, "account");
}
