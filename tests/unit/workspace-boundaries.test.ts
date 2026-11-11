import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/session";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  client: vi.fn(),
  privileged: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.session,
  AuthAvailabilityError: class extends Error {},
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: mocks.privileged,
}));

import { apiSession } from "@/server/api";
import * as legacyDocuments from "@/app/api/v1/documents/route";
import * as legacyDocument from "@/app/api/v1/documents/[documentId]/route";
import * as legacyFile from "@/app/api/v1/documents/[documentId]/file/route";
import * as legacyRevision from "@/app/api/v1/documents/[documentId]/resubmissions/route";
import { GET as dashboard } from "@/app/api/v1/dashboard/route";
import { GET as categories } from "@/app/api/v1/categories/route";
import * as documents from "@/app/api/v2/signing-documents/route";
import * as document from "@/app/api/v2/signing-documents/[documentId]/route";
import * as source from "@/app/api/v2/signing-documents/[documentId]/file/route";
import * as requests from "@/app/api/v2/signing-requests/route";
import * as request from "@/app/api/v2/signing-requests/[requestId]/route";
import * as cancel from "@/app/api/v2/signing-requests/[requestId]/cancel/route";
import * as decision from "@/app/api/v2/signing-requests/[requestId]/decision/route";
import * as decide from "@/app/api/v2/signing-requests/[requestId]/decisions/route";
import * as receipt from "@/app/api/v2/signing-receipts/[receiptId]/route";
import * as result from "@/app/api/v2/signing-receipts/[receiptId]/file/route";
import * as render from "@/app/api/v2/signing-receipts/[receiptId]/render/route";
import * as lookup from "@/app/api/v2/recipients/lookup/route";
import { GET as userCode } from "@/app/api/v2/me/user-code/route";

const id = "10000000-0000-4000-8000-000000000001";
const documentContext = { params: Promise.resolve({ documentId: id }) };
const requestContext = { params: Promise.resolve({ requestId: id }) };
const receiptContext = {
  params: Promise.resolve({ receiptId: "r".repeat(43) }),
};
const get = () => new Request("http://127.0.0.1:3000/private");
const post = () =>
  new Request("http://127.0.0.1:3000/private", { method: "POST" });
const endpoints = [
  { name: "archive dashboard", run: () => dashboard() },
  { name: "categories", run: () => categories() },
  { name: "archive list", run: () => legacyDocuments.GET(get()) },
  { name: "archive upload", run: () => legacyDocuments.POST(post()) },
  {
    name: "archive detail",
    run: () => legacyDocument.GET(get(), documentContext),
  },
  { name: "archive PDF", run: () => legacyFile.GET(get(), documentContext) },
  {
    name: "archive revision",
    run: () => legacyRevision.POST(post(), documentContext),
  },
  { name: "signing list", run: () => documents.GET(get()) },
  { name: "signing upload", run: () => documents.POST(post()) },
  { name: "signing detail", run: () => document.GET(get(), documentContext) },
  { name: "signing PDF", run: () => source.GET(get(), documentContext) },
  { name: "request list", run: () => requests.GET(get()) },
  { name: "send request", run: () => requests.POST(post()) },
  { name: "request detail", run: () => request.GET(get(), requestContext) },
  { name: "cancel request", run: () => cancel.POST(post(), requestContext) },
  { name: "read decision", run: () => decision.GET(get(), requestContext) },
  { name: "commit decision", run: () => decide.POST(post(), requestContext) },
  { name: "web evidence", run: () => receipt.GET(get(), receiptContext) },
  { name: "result PDF", run: () => result.GET(get(), receiptContext) },
  { name: "render result", run: () => render.POST(post(), receiptContext) },
  { name: "recipient lookup", run: () => lookup.POST(post()) },
  { name: "own signing code", run: () => userCode() },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockRejectedValue(new Error("Database must not be accessed."));
  mocks.privileged.mockImplementation(() => {
    throw new Error("Privileged client must not be accessed.");
  });
});

describe("admin-only workspace boundaries through actual HTTP handlers and DAL", () => {
  it.each(endpoints)(
    "denies $name before data, storage or business actions",
    async ({ run }) => {
      for (const roles of [
        ["platform_admin"],
        ["user", "platform_admin"],
        ["user", "reviewer", "platform_admin"],
      ] as AuthSession["roles"][]) {
        mocks.session.mockResolvedValue({
          user: { id, emailConfirmed: true },
          roles,
        });
        const response = await run();
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toContain("no-store");
        expect(response.headers.get("vary")).toContain("Cookie");
        expect((await response.json()).error.code).toBe(
          "USER_WORKSPACE_NOT_ALLOWED",
        );
      }
      expect(mocks.client).not.toHaveBeenCalled();
      expect(mocks.privileged).not.toHaveBeenCalled();
    },
  );
  it("retains shared account authentication without enabling user business access", async () => {
    const session = {
      user: { id, emailConfirmed: true },
      roles: ["user", "platform_admin"],
    };
    mocks.session.mockResolvedValue(session);
    expect(await apiSession("account")).toEqual(session);
    await expect(apiSession("user")).rejects.toMatchObject({
      status: 403,
      code: "USER_WORKSPACE_NOT_ALLOWED",
    });
  });
});
