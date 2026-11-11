import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type {
  Category,
  DashboardData,
  DocumentDetail,
  DocumentListResult,
} from "../../src/server/workspace/types";

test.use({ trace: "off", screenshot: "off" });
const expectedHash =
  "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
const zeroCounts = {
  total: 0,
  pendingReview: 0,
  revisionRequested: 0,
  approved: 0,
  rejected: 0,
  revoked: 0,
};
type Receipt = {
  documentId: string;
  submissionId: string;
  versionNo: number;
  status: string;
  submittedAt: string;
};
type SafeFailure = { status: number; code?: string; requestId?: string };

async function data<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path, { maxRedirects: 0 });
  expect(
    response.status(),
    "Expected an authenticated application response",
  ).toBe(200);
  return ((await response.json()) as { data: T }).data;
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login?next=%2Fdocuments");
  await page.getByLabel(/^Email\s*\*?$/).fill(email);
  const input = page.getByLabel(/^Kata sandi\s*\*?$/);
  try {
    await input.fill(password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/documents", {
      timeout: 25_000,
    });
  } catch {
    if (await input.count()) await input.fill("").catch(() => {});
    throw new Error(
      "Synthetic sign-in did not complete; credential values are omitted.",
    );
  }
}
function assertSafeDto(value: unknown) {
  let unsafe = false;
  function visit(item: unknown) {
    if (typeof item !== "object" || item === null) return;
    for (const [key, child] of Object.entries(item)) {
      if (
        /storage[_-]?(path|bucket)|secret|token|verification[_-]?code|code[_-]?digest|qr[_-]?(code|payload)|^code$|^qr$|^filePath$/i.test(
          key,
        )
      )
        unsafe = true;
      visit(child);
    }
  }
  visit(value);
  expect(
    unsafe,
    "Private DTO must not expose storage or credential fields",
  ).toBe(false);
}

test("one persistent synthetic submission preserves bytes, idempotency and ownership", async ({
  page,
  browser,
  playwright,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  test.skip(
    process.env.DVP_CLOUD_CONFIRM !== "persistent-development-fixture",
    "Requires explicit persistent-fixture helper opt-in.",
  );
  const runId = process.env.DVP_CLOUD_RUN_ID;
  const ownerId = process.env.DVP_CLOUD_OWNER_ID;
  const comparatorId = process.env.DVP_CLOUD_COMPARATOR_ID;
  const ownerEmail = process.env.DVP_CLOUD_OWNER_EMAIL;
  const ownerPassword = process.env.DVP_CLOUD_OWNER_PASSWORD;
  const comparatorEmail = process.env.DVP_CLOUD_COMPARATOR_EMAIL;
  const comparatorPassword = process.env.DVP_CLOUD_COMPARATOR_PASSWORD;
  const providerUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !runId ||
    !/^[a-f0-9-]{36}$/.test(runId) ||
    !ownerId ||
    !comparatorId ||
    !ownerEmail ||
    !ownerPassword ||
    !comparatorEmail ||
    !comparatorPassword ||
    !providerUrl ||
    !publicKey ||
    !baseURL ||
    ownerEmail !== `dvp-cloud-owner-${runId}@example.invalid` ||
    comparatorEmail !== `dvp-cloud-comparator-${runId}@example.invalid`
  )
    throw new Error(
      "Cloud acceptance requires the helper's exact synthetic account configuration.",
    );
  const fixturePath = resolve("tests/fixtures/phase-3-development.pdf");
  const fixture = await readFile(fixturePath);
  expect(fixture.length).toBe(2831);
  expect(createHash("sha256").update(fixture).digest("hex")).toBe(expectedHash);
  const proofPath = resolve("test-results", `cloud-workspace-${runId}.json`);
  const checks: string[] = [];
  let receipt: Receipt | undefined;
  let lastFailure: SafeFailure | undefined;
  async function saveProof() {
    const proof = JSON.parse(await readFile(proofPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (proof.runId !== runId) throw new Error("Cloud proof marker mismatch.");
    await writeFile(
      proofPath,
      `${JSON.stringify({ ...proof, receipt, checks, lastFailure }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
  const comparator = await browser.newContext({ baseURL });
  const guest = await playwright.request.newContext({ baseURL });
  try {
    await login(page, ownerEmail, ownerPassword);
    const me = await data<{
      user: { id: string; emailConfirmed: boolean };
      roles: string[];
    }>(page.request, "/api/v1/me");
    expect(me.user.id).toBe(ownerId);
    expect(me.user.emailConfirmed).toBe(true);
    expect(me.roles).toEqual(["user"]);
    const baseline = await data<DashboardData>(
      page.request,
      "/api/v1/dashboard",
    );
    expect(baseline.counts).toEqual(zeroCounts);
    expect(
      (await data<DocumentListResult>(page.request, "/api/v1/documents")).items,
    ).toEqual([]);
    const categories = await data<Category[]>(
      page.request,
      "/api/v1/categories",
    );
    const category = categories.find((item) => item.slug === "pendidikan");
    if (!category)
      throw new Error("The approved Pendidikan category is unavailable.");
    checks.push("owner_normal_role_and_real_empty_baseline");
    await saveProof();
    const title = `UJI DEVELOPMENT — Phase 3 — ${runId}`;
    await page.goto("/submit");
    await page.getByLabel(/^Nama dokumen\s*\*?$/).fill(title);
    await page.getByLabel(/^Kategori dokumen\s*\*?$/).selectOption(category.id);
    await page
      .getByLabel("File PDF", { exact: true })
      .setInputFiles(fixturePath);
    await page.getByRole("checkbox").check();
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/documents" &&
        response.request().method() === "POST",
      { timeout: 50_000 },
    );
    await page
      .getByRole("button", { name: "Ajukan dokumen", exact: true })
      .click();
    const submitted = await responsePromise;
    if (submitted.status() !== 201) {
      lastFailure = { status: submitted.status() };
      const body: unknown = await submitted.json().catch(() => null);
      if (typeof body === "object" && body !== null && "error" in body) {
        const error = body.error;
        if (typeof error === "object" && error !== null) {
          if (
            "code" in error &&
            typeof error.code === "string" &&
            /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
          )
            lastFailure.code = error.code;
          if (
            "requestId" in error &&
            typeof error.requestId === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              error.requestId,
            )
          )
            lastFailure.requestId = error.requestId;
        }
      }
      await saveProof();
    }
    expect(
      submitted.status(),
      "The initial synthetic submission must commit successfully",
    ).toBe(201);
    receipt = ((await submitted.json()) as { data: Receipt }).data;
    expect(receipt.versionNo).toBe(1);
    expect(receipt.status).toBe("pending_review");
    expect(Number.isFinite(Date.parse(receipt.submittedAt))).toBe(true);
    for (const id of [receipt.documentId, receipt.submissionId])
      expect(/^[a-f0-9-]{36}$/.test(id)).toBe(true);
    assertSafeDto(receipt);
    checks.push("actual_ui_submission_pending_version_one");
    await saveProof();
    const key = submitted.request().headers()["idempotency-key"];
    if (!key) throw new Error("Application idempotency key was not captured.");
    await expect(page).toHaveURL(
      (url) => url.pathname === `/documents/${receipt!.documentId}`,
      { timeout: 20_000 },
    );
    const multipart = {
      title,
      categoryId: category.id,
      policyVersion: "development-2026-11-04",
      consent: "true",
      file: {
        name: "phase-3-development.pdf",
        mimeType: "application/pdf",
        buffer: fixture,
      },
    };
    const headers = { Origin: baseURL, "Idempotency-Key": key };
    const repeated = await page.request.post("/api/v1/documents", {
      headers,
      multipart,
    });
    expect(repeated.status()).toBe(201);
    expect(((await repeated.json()) as { data: Receipt }).data).toEqual(
      receipt,
    );
    const conflict = await page.request.post("/api/v1/documents", {
      headers,
      multipart: { ...multipart, title: `${title} changed` },
    });
    expect(conflict.status()).toBe(409);
    expect((await conflict.json()).error?.code).toBe("IDEMPOTENCY_CONFLICT");
    checks.push("same_key_same_receipt_and_changed_payload_conflict");
    const dashboard = await data<DashboardData>(
      page.request,
      "/api/v1/dashboard",
    );
    expect(dashboard.counts).toEqual({
      ...zeroCounts,
      total: 1,
      pendingReview: 1,
    });
    const list = await data<DocumentListResult>(
      page.request,
      `/api/v1/documents?status=pending_review&categoryId=${category.id}&q=${encodeURIComponent(runId)}`,
    );
    expect(list.items.map((item) => item.id)).toEqual([receipt.documentId]);
    const detail = await data<DocumentDetail>(
      page.request,
      `/api/v1/documents/${receipt.documentId}`,
    );
    expect(detail.status).toBe("pending_review");
    expect(detail.title).toBe(title);
    expect(detail.fileName).toBe("phase-3-development.pdf");
    expect(detail.fileSizeBytes).toBe(fixture.length);
    expect(detail.sha256).toBe(expectedHash);
    expect(detail.versions).toHaveLength(1);
    expect(detail.policyVersion).toBe("development-2026-11-04");
    expect(Number.isFinite(Date.parse(detail.consentedAt))).toBe(true);
    assertSafeDto(detail);
    assertSafeDto(list);
    checks.push("real_owner_counts_filters_and_version_metadata");
    const filePath = `/api/v1/documents/${receipt.documentId}/file`;
    const historicalPath = `${filePath}?submissionId=${receipt.submissionId}`;
    for (const pathname of [
      filePath,
      historicalPath,
      `${historicalPath}&download=1`,
    ]) {
      const file = await page.request.get(pathname);
      expect(file.status()).toBe(200);
      expect(
        createHash("sha256")
          .update(await file.body())
          .digest("hex"),
      ).toBe(expectedHash);
      expect(file.headers()["cache-control"]).toContain("no-store");
      expect(file.headers()["x-content-type-options"]).toBe("nosniff");
      expect(file.headers()["referrer-policy"]).toBe("no-referrer");
      expect(file.headers()["x-frame-options"]).toBe("SAMEORIGIN");
      expect(file.headers()["content-type"]).toContain("application/pdf");
      if (pathname.endsWith("download=1"))
        expect(file.headers()["content-disposition"]).toContain("attachment");
    }
    const range = await page.request.get(filePath, {
      headers: { Range: "bytes=0-15" },
    });
    expect(range.status()).toBe(206);
    expect(range.headers()["content-range"]).toBe(
      `bytes 0-15/${fixture.length}`,
    );
    expect((await range.body()).equals(fixture.subarray(0, 16))).toBe(true);
    checks.push("private_current_historical_download_and_byte_range_integrity");
    const otherPage = await comparator.newPage();
    await login(otherPage, comparatorEmail, comparatorPassword);
    const otherMe = await data<{ user: { id: string }; roles: string[] }>(
      comparator.request,
      "/api/v1/me",
    );
    expect(otherMe.user.id).toBe(comparatorId);
    expect(otherMe.roles).toEqual(["user"]);
    for (const pathname of [
      `/api/v1/documents/${receipt.documentId}`,
      filePath,
      historicalPath,
    ]) {
      const rejected = await comparator.request.get(pathname);
      expect(rejected.status()).toBe(404);
      expect((await rejected.json()).error?.code).toBe("NOT_FOUND");
    }
    const foreignRevision = await comparator.request.post(
      `/api/v1/documents/${receipt.documentId}/resubmissions`,
      {
        headers: { Origin: baseURL, "Idempotency-Key": randomUUID() },
        multipart,
      },
    );
    expect(foreignRevision.status()).toBe(404);
    expect(
      (await data<DashboardData>(comparator.request, "/api/v1/dashboard"))
        .counts,
    ).toEqual(zeroCounts);
    expect(
      (await data<DocumentListResult>(comparator.request, "/api/v1/documents"))
        .items,
    ).toEqual([]);
    expect((await guest.get(filePath)).status()).toBe(401);
    checks.push("foreign_detail_file_and_revision_hidden_guest_denied");
    const pendingRevision = await page.request.post(
      `/api/v1/documents/${receipt.documentId}/resubmissions`,
      {
        headers: { Origin: baseURL, "Idempotency-Key": randomUUID() },
        multipart,
      },
    );
    expect(pendingRevision.status()).toBe(409);
    expect((await pendingRevision.json()).error?.code).toBe(
      "DOCUMENT_NOT_ELIGIBLE",
    );
    checks.push("pending_submission_cannot_be_revised_without_review");
    const objectPath = `${ownerId}/${receipt.documentId}/${receipt.submissionId}.pdf`;
    // Node-only path assertion; never placed in a browser DTO or log message.
    const provider = createClient(providerUrl, publicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (input, init) => {
          try {
            return await fetch(input, {
              ...init,
              redirect: "error",
              signal: AbortSignal.timeout(15_000),
            });
          } catch {
            throw new Error("Synthetic provider request did not complete.");
          }
        },
      },
    });
    const signed = await provider.auth.signInWithPassword({
      email: ownerEmail,
      password: ownerPassword,
    });
    expect(Boolean(signed.error)).toBe(false);
    const direct = await provider.storage
      .from("document-submissions")
      .download(objectPath);
    expect(Boolean(direct.data)).toBe(false);
    expect(Boolean(direct.error)).toBe(true);
    await provider.auth.signOut({ scope: "local" });
    let publicFile: Response;
    try {
      publicFile = await fetch(
        `${new URL(providerUrl).origin}/storage/v1/object/public/document-submissions/${objectPath}`,
        { redirect: "error", signal: AbortSignal.timeout(15_000) },
      );
    } catch {
      throw new Error(
        "Public Storage boundary could not be checked; paths are omitted.",
      );
    }
    expect(publicFile.ok).toBe(false);
    checks.push("public_and_authenticated_direct_storage_access_denied");
    const finalDetail = await data<DocumentDetail>(
      page.request,
      `/api/v1/documents/${receipt.documentId}`,
    );
    expect(finalDetail.versions).toHaveLength(1);
    expect(finalDetail.sha256).toBe(expectedHash);
    await saveProof();
    const [preview, previewResponse] = await Promise.all([
      page.waitForEvent("popup", { timeout: 20_000 }),
      page.context().waitForEvent("response", {
        predicate: (response) => new URL(response.url()).pathname === filePath,
        timeout: 20_000,
      }),
      page.getByRole("link", { name: "Buka preview PDF", exact: true }).click(),
    ]);
    try {
      expect([200, 206].includes(previewResponse.status())).toBe(true);
      await preview.waitForLoadState("load", { timeout: 20_000 });
      // The native PDF renderer paints after the navigation's load event.
      await preview.waitForTimeout(750);
      await preview.screenshot({
        path: testInfo.outputPath("synthetic-private-pdf-preview.png"),
        fullPage: false,
      });
      checks.push("actual_private_pdf_popup_snapshot_for_visual_review");
      await saveProof();
    } finally {
      await preview.close();
    }
    await otherPage
      .getByRole("button", { name: "Keluar", exact: true })
      .click();
    await page.getByRole("button", { name: "Keluar", exact: true }).click();
  } finally {
    await comparator.close();
    await guest.dispose();
  }
});
