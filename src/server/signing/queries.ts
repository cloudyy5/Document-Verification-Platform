import "server-only";
import { z } from "zod";
import type { AuthSession } from "@/lib/auth/session";
import { isCalendarDate } from "@/lib/documents/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNING_USER_CODE_PATTERN } from "@/lib/signing/policy";
import { apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getSigningConfiguration } from "./config";
import { signingUnavailable } from "./errors";
import type {
  SigningDocument,
  SigningPage,
  SigningRequest,
  SigningRequestStatus,
  SigningUserCode,
} from "./types";

export {
  cancelSigningRequest,
  lookupSigningRecipient,
  sendSigningRequest,
} from "./mutations";
export { mapSigningDatabaseError } from "./errors";

type UserClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Context = { session: AuthSession; client: UserClient };

const timestamp = z.iso.datetime({ offset: true }).max(40);
const nullableText = z.string().nullable();
const versionSchema = z.object({
  id: z.uuid(),
  document_id: z.uuid(),
  owner_id: z.uuid(),
  version_no: z.literal(1),
  title: z.string().min(1).max(200),
  category_id: z.uuid(),
  custom_document_type: nullableText,
  document_date: z.string().refine(isCalendarDate).nullable(),
  issuing_institution: nullableText,
  description: nullableText,
  original_filename: z.string().min(1).max(255),
  file_size_bytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024),
  source_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  created_at: timestamp,
});
const requestSchema = z.object({
  id: z.uuid(),
  document_id: z.uuid(),
  source_version_id: z.uuid(),
  owner_id: z.uuid(),
  recipient_id: z.uuid(),
  owner_display_name: z.string().min(1).max(120),
  recipient_display_name: z.string().min(1).max(120),
  status: z.enum([
    "pending",
    "cancelled",
    "rejected",
    "consented",
    "completed",
  ]),
  sent_at: timestamp,
  expires_at: timestamp,
  cancelled_at: timestamp.nullable(),
});
type VersionRow = z.infer<typeof versionSchema>;
type RequestRow = z.infer<typeof requestSchema>;

// Deliberately omit storage_path, policy internals and all account contact data.
const versionFields =
  "id,document_id,owner_id,version_no,title,category_id,custom_document_type,document_date,issuing_institution,description,original_filename,file_size_bytes,source_sha256,created_at";
const requestFields =
  "id,document_id,source_version_id,owner_id,recipient_id,owner_display_name,recipient_display_name,status,sent_at,expires_at,cancelled_at";

async function withSigning<T>(
  run: (context: Context) => Promise<T>,
): Promise<T> {
  try {
    const session = await apiSession("user");
    getSigningConfiguration();
    const client = await createSupabaseServerClient();
    return await run({ session, client });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // Schema failures in database responses are availability errors, not input errors.
    throw signingUnavailable();
  }
}

function invalidInput(): ApiError {
  return new ApiError(422, "VALIDATION_ERROR", "Parameter daftar tidak valid.");
}

const pageSchema = z.strictObject({
  cursor: z
    .string()
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  limit: z
    .union([
      z.number(),
      z
        .string()
        .regex(/^\d{1,2}$/)
        .transform(Number),
    ])
    .pipe(z.number().int().min(1).max(50))
    .optional(),
});
const requestsPageSchema = pageSchema.extend({
  scope: z.enum(["received", "sent"]),
});
const cursorSchema = z.strictObject({
  at: timestamp,
  id: z.uuid(),
});
type Cursor = z.infer<typeof cursorSchema>;

function decodeCursor(input: string | undefined): Cursor | undefined {
  if (!input) return undefined;
  try {
    return cursorSchema.parse(
      JSON.parse(Buffer.from(input, "base64url").toString("utf8")),
    );
  } catch {
    throw invalidInput();
  }
}
function encodeCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id })).toString("base64url");
}
function parsePage(input: unknown) {
  const parsed = pageSchema.safeParse(input);
  if (!parsed.success) throw invalidInput();
  return {
    limit: parsed.data.limit ?? 20,
    after: decodeCursor(parsed.data.cursor),
  };
}
function parseRequestsPage(input: unknown) {
  const parsed = requestsPageSchema.safeParse(input);
  if (!parsed.success) throw invalidInput();
  return {
    scope: parsed.data.scope,
    limit: parsed.data.limit ?? 20,
    after: decodeCursor(parsed.data.cursor),
  };
}

function participant(row: RequestRow, userId: string): boolean {
  return row.owner_id === userId || row.recipient_id === userId;
}
function requestStatus(row: RequestRow, now: number): SigningRequestStatus {
  return row.status === "pending" && Date.parse(row.expires_at) <= now
    ? "expired"
    : row.status;
}
function readableVersion(
  row: RequestRow,
  version: VersionRow | undefined,
  userId: string,
  now: number,
): VersionRow | null {
  if (!version) return null;
  if (
    version.id !== row.source_version_id ||
    version.document_id !== row.document_id ||
    version.owner_id !== row.owner_id
  )
    throw signingUnavailable();
  if (row.owner_id === userId) return version;
  const status = requestStatus(row, now);
  // The database RLS decides access using its own clock. This time check only
  // further restricts presentation; it can never restore an RLS-hidden version.
  return status === "pending" ||
    status === "consented" ||
    status === "completed"
    ? version
    : null;
}
function mapRequest(
  row: RequestRow,
  version: VersionRow | null,
  userId: string,
  now: number,
): SigningRequest {
  return {
    id: row.id,
    documentId: row.document_id,
    sourceVersionId: row.source_version_id,
    ownerName: row.owner_display_name,
    recipientName: row.recipient_display_name,
    documentTitle: version?.title ?? null,
    status: requestStatus(row, now),
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    cancelledAt: row.cancelled_at,
    isOwner: row.owner_id === userId,
    canReadFile: version !== null,
  };
}
function mapDocument(
  row: VersionRow,
  userId: string,
  request: SigningRequest | null,
): SigningDocument {
  return {
    id: row.document_id,
    versionId: row.id,
    versionNo: row.version_no,
    title: row.title,
    categoryId: row.category_id,
    customDocumentType: row.custom_document_type,
    documentDate: row.document_date,
    issuingInstitution: row.issuing_institution,
    description: row.description,
    fileName: row.original_filename,
    fileSizeBytes: row.file_size_bytes,
    sha256: row.source_sha256,
    createdAt: row.created_at,
    isOwner: row.owner_id === userId,
    request,
  };
}

async function requestsForVersions(context: Context, versions: VersionRow[]) {
  if (!versions.length) return new Map<string, RequestRow>();
  const { data, error } = await context.client
    .from("signing_requests")
    .select(requestFields)
    .in(
      "source_version_id",
      versions.map((row) => row.id),
    )
    .or(
      `owner_id.eq.${context.session.user.id},recipient_id.eq.${context.session.user.id}`,
    );
  if (error || !data) throw signingUnavailable();
  const rows = z.array(requestSchema).max(versions.length).parse(data);
  const allowedIds = new Set(versions.map((row) => row.id));
  if (
    rows.some(
      (row) =>
        !participant(row, context.session.user.id) ||
        !allowedIds.has(row.source_version_id),
    ) ||
    new Set(rows.map((row) => row.source_version_id)).size !== rows.length
  )
    throw signingUnavailable();
  return new Map(rows.map((row) => [row.source_version_id, row]));
}

export async function getSigningUserCode(): Promise<SigningUserCode> {
  return withSigning(async ({ client, session }) => {
    const { data, error } = await client
      .from("signing_user_identifiers")
      .select("user_id,code,created_at")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error || !data) throw signingUnavailable();
    const row = z
      .object({
        user_id: z.uuid(),
        code: z.string().regex(SIGNING_USER_CODE_PATTERN),
        created_at: timestamp,
      })
      .parse(data);
    if (row.user_id !== session.user.id) throw signingUnavailable();
    return { code: row.code, createdAt: row.created_at };
  });
}

export async function getSigningDocuments(
  input: unknown = {},
): Promise<SigningPage<SigningDocument>> {
  return withSigning(async (context) => {
    const { client, session } = context;
    const { limit, after } = parsePage(input);
    let query = client
      .from("signing_document_versions")
      .select(versionFields)
      .eq("owner_id", session.user.id)
      .eq("version_no", 1)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (after)
      query = query.or(
        `created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`,
      );
    const { data, error } = await query;
    if (error || !data) throw signingUnavailable();
    const rows = z
      .array(versionSchema)
      .max(limit + 1)
      .parse(data);
    if (rows.some((row) => row.owner_id !== session.user.id))
      throw signingUnavailable();
    const page = rows.slice(0, limit);
    const requests = await requestsForVersions(context, page);
    const now = Date.now();
    const last = page.at(-1);
    const hasMore = rows.length > limit;
    return {
      items: page.map((row) => {
        const request = requests.get(row.id);
        const visible = request
          ? readableVersion(request, row, session.user.id, now)
          : null;
        return mapDocument(
          row,
          session.user.id,
          request ? mapRequest(request, visible, session.user.id, now) : null,
        );
      }),
      hasMore,
      cursor: hasMore && last ? encodeCursor(last.created_at, last.id) : null,
    };
  });
}

export async function getSigningDocument(
  documentId: string,
): Promise<SigningDocument | null> {
  return withSigning(async (context) => {
    if (!z.uuid().safeParse(documentId).success) return null;
    const id = documentId.toLowerCase();
    const { client, session } = context;
    const { data, error } = await client
      .from("signing_document_versions")
      .select(versionFields)
      .eq("document_id", id)
      .eq("version_no", 1)
      .maybeSingle();
    if (error) throw signingUnavailable();
    if (!data) return null;
    const version = versionSchema.parse(data);
    if (version.document_id !== id) throw signingUnavailable();
    const requests = await requestsForVersions(context, [version]);
    const request = requests.get(version.id);
    const now = Date.now();
    const visible = request
      ? readableVersion(request, version, session.user.id, now)
      : null;
    if (version.owner_id !== session.user.id && (!request || !visible))
      return null;
    return mapDocument(
      version,
      session.user.id,
      request ? mapRequest(request, visible, session.user.id, now) : null,
    );
  });
}

async function versionsForRequests(context: Context, requests: RequestRow[]) {
  if (!requests.length) return new Map<string, VersionRow>();
  const { data, error } = await context.client
    .from("signing_document_versions")
    .select(versionFields)
    .in(
      "id",
      requests.map((row) => row.source_version_id),
    )
    .eq("version_no", 1);
  if (error || !data) throw signingUnavailable();
  const rows = z.array(versionSchema).max(requests.length).parse(data);
  const allowedIds = new Set(requests.map((row) => row.source_version_id));
  if (
    rows.some((row) => !allowedIds.has(row.id)) ||
    new Set(rows.map((row) => row.id)).size !== rows.length
  )
    throw signingUnavailable();
  return new Map(rows.map((row) => [row.id, row]));
}

export async function getSigningRequests(input: {
  scope: "received" | "sent";
  cursor?: string;
  limit?: number | string;
}): Promise<SigningPage<SigningRequest>> {
  return withSigning(async (context) => {
    const { client, session } = context;
    const { scope, limit, after } = parseRequestsPage(input);
    let query = client
      .from("signing_requests")
      .select(requestFields)
      .eq(scope === "sent" ? "owner_id" : "recipient_id", session.user.id)
      .order("sent_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (after)
      query = query.or(
        `sent_at.lt.${after.at},and(sent_at.eq.${after.at},id.lt.${after.id})`,
      );
    const { data, error } = await query;
    if (error || !data) throw signingUnavailable();
    const rows = z
      .array(requestSchema)
      .max(limit + 1)
      .parse(data);
    if (
      rows.some((row) =>
        scope === "sent"
          ? row.owner_id !== session.user.id
          : row.recipient_id !== session.user.id,
      )
    )
      throw signingUnavailable();
    const page = rows.slice(0, limit);
    const versions = await versionsForRequests(context, page);
    const now = Date.now();
    const last = page.at(-1);
    const hasMore = rows.length > limit;
    return {
      items: page.map((row) =>
        mapRequest(
          row,
          readableVersion(
            row,
            versions.get(row.source_version_id),
            session.user.id,
            now,
          ),
          session.user.id,
          now,
        ),
      ),
      hasMore,
      cursor: hasMore && last ? encodeCursor(last.sent_at, last.id) : null,
    };
  });
}

export async function getSigningRequest(requestId: string): Promise<{
  request: SigningRequest;
  document: SigningDocument | null;
} | null> {
  return withSigning(async (context) => {
    if (!z.uuid().safeParse(requestId).success) return null;
    const id = requestId.toLowerCase();
    const { client, session } = context;
    const { data, error } = await client
      .from("signing_requests")
      .select(requestFields)
      .eq("id", id)
      .or(`owner_id.eq.${session.user.id},recipient_id.eq.${session.user.id}`)
      .maybeSingle();
    if (error) throw signingUnavailable();
    if (!data) return null;
    const row = requestSchema.parse(data);
    if (row.id !== id || !participant(row, session.user.id)) return null;
    const versions = await versionsForRequests(context, [row]);
    const now = Date.now();
    const visible = readableVersion(
      row,
      versions.get(row.source_version_id),
      session.user.id,
      now,
    );
    const request = mapRequest(row, visible, session.user.id, now);
    return {
      request,
      document: visible ? mapDocument(visible, session.user.id, request) : null,
    };
  });
}
