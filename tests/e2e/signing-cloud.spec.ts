import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";
import type { Category } from "../../src/server/workspace/types";
import type {
  SigningDocument,
  SigningPage,
  SigningRequest,
  SigningRequestReceipt,
} from "../../src/server/signing/types";
import {
  SIGNING_UPLOAD_POLICY_VERSION,
  SIGNING_UPLOAD_CONSENT_TEXT,
  SIGNING_SHARING_CONSENT_TEXT,
} from "../../src/lib/signing/policy";

// This suite is excluded from default E2E and requires the persistent-fixture
// runner's opt-in. No fixtures, accounts or decisions are created on import.
test.use({ trace: "off", screenshot: "off", video: "off" });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fixtureSha256 =
  "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
type Account = { id: string; email: string; password: string };
type DraftReceipt = {
  documentId: string;
  versionId: string;
  versionNo: number;
  status: string;
  createdAt: string;
};
type ProofReceipt = {
  documentId: string;
  versionId: string;
  requestId?: string;
  status: "draft" | "pending" | "cancelled";
};

function account(name: "A" | "B" | "C", runId: string): Account {
  const prefix = `DVP_SIGNING_CLOUD_${name}_`;
  const id = process.env[`${prefix}ID`];
  const email = process.env[`${prefix}EMAIL`];
  const password = process.env[`${prefix}PASSWORD`];
  if (
    !id ||
    !uuid.test(id) ||
    !email ||
    !email.endsWith("@example.invalid") ||
    !email.includes(runId) ||
    !password
  )
    throw new Error(
      "The signing fixture runner's synthetic account is required.",
    );
  return { id, email, password };
}

function privateResponse(
  response: Pick<APIResponse, "status" | "headers">,
  status: number,
) {
  expect(response.status()).toBe(status);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["vary"]?.toLowerCase()).toContain("cookie");
}

async function data<T>(request: APIRequestContext, path: string): Promise<T> {
  const response = await request.get(path, { maxRedirects: 0 });
  privateResponse(response, 200);
  return ((await response.json()) as { data: T }).data;
}

async function login(page: Page, actor: Account) {
  try {
    await page.goto("/login?next=%2Fprofile");
    await page.getByLabel(/^Email\s*\*?$/).fill(actor.email);
    await page.getByLabel(/^Kata sandi\s*\*?$/).fill(actor.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile", {
      timeout: 25_000,
    });
  } catch {
    // Playwright call logs can include fill() arguments even with trace off.
    throw new Error(
      "Synthetic login did not complete; credentials are omitted.",
    );
  }
  const me = await data<{
    user: { id: string; emailConfirmed: boolean };
    roles: string[];
  }>(page.request, "/api/v1/me");
  expect(me.user.id).toBe(actor.id);
  expect(me.user.emailConfirmed).toBe(true);
  expect(me.roles).toEqual(["user"]);
  const identity = await data<{ code: string; createdAt: string }>(
    page.request,
    "/api/v2/me/user-code",
  );
  expect(/^DVP-[0-9A-F]{20}$/.test(identity.code)).toBe(true);
  await expect(page.locator("#own-signing-code")).toBeVisible();
  const shown = await page
    .locator('section[aria-labelledby="own-signing-code"] code')
    .textContent();
  expect(shown === identity.code).toBe(true);
  return identity.code;
}

function assertSafeDto(value: unknown) {
  let unsafe = false;
  function visit(item: unknown) {
    if (!item || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      if (
        /storage[_-]?(path|bucket)|secret|token|qr[_-]?(code|payload)|^qr$/i.test(
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
    "Document/request DTO must omit privileged file credentials",
  ).toBe(false);
}

test("one synthetic signing invitation preserves private version access and cancellation", async ({
  page,
  browser,
  playwright,
  baseURL,
}) => {
  test.setTimeout(240_000);
  test.skip(
    process.env.DVP_SIGNING_CLOUD_TEST !== "1",
    "Requires the explicit persistent-signing-fixture runner.",
  );
  const runId = process.env.DVP_SIGNING_CLOUD_RUN_ID;
  const configuredProof = process.env.DVP_SIGNING_CLOUD_PROOF;
  const providerUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !runId ||
    !uuid.test(runId) ||
    !configuredProof ||
    !providerUrl ||
    !publicKey ||
    !baseURL
  )
    throw new Error(
      "The signing fixture runner's exact configuration is required.",
    );
  const proofPath = resolve(configuredProof);
  if (!proofPath.startsWith(`${resolve("test-results")}${sep}`))
    throw new Error(
      "The safe proof must remain in the workspace test-results directory.",
    );
  const actors = {
    A: account("A", runId),
    B: account("B", runId),
    C: account("C", runId),
  };
  if (new Set(Object.values(actors).map((actor) => actor.id)).size !== 3)
    throw new Error("Three distinct synthetic accounts are required.");
  const fixture = await readFile(
    resolve("tests/fixtures/phase-3-development.pdf"),
  );
  expect(fixture.byteLength).toBe(2831);
  expect(createHash("sha256").update(fixture).digest("hex")).toBe(
    fixtureSha256,
  );
  const checks: string[] = [];
  let receipt: ProofReceipt | undefined;
  let status: "running" | "passed" | "failed" = "running";
  let stage = "synthetic_login";
  async function saveProof() {
    const prior = JSON.parse(await readFile(proofPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (prior.runId !== runId)
      throw new Error("The signing proof run marker does not match.");
    const temporary = `${proofPath}.tmp`;
    await mkdir(dirname(proofPath), { recursive: true });
    await writeFile(
      temporary,
      `${JSON.stringify({ ...prior, runId, status, receipt, checks, stage }, null, 2)}\n`,
      { mode: 0o600 },
    );
    await rename(temporary, proofPath);
  }
  async function checked(name: string) {
    checks.push(name);
    await saveProof();
  }
  const recipient = await browser.newContext({ baseURL });
  const outsider = await browser.newContext({ baseURL });
  const guest = await playwright.request.newContext({ baseURL });
  const providers: ReturnType<typeof createClient<Database>>[] = [];
  async function provider(actor: Account) {
    const client = createClient<Database>(providerUrl!, publicKey!, {
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
    providers.push(client);
    try {
      const signed = await client.auth.signInWithPassword({
        email: actor.email,
        password: actor.password,
      });
      if (
        signed.error ||
        signed.data.user?.id !== actor.id ||
        !signed.data.session
      )
        throw new Error("Synthetic provider authentication failed.");
      return { client, accessToken: signed.data.session.access_token };
    } catch {
      throw new Error(
        "Synthetic provider authentication failed; credentials are omitted.",
      );
    }
  }
  try {
    const recipientPage = await recipient.newPage();
    const outsiderPage = await outsider.newPage();
    const ownCode = await login(page, actors.A);
    const recipientCode = await login(recipientPage, actors.B);
    await login(outsiderPage, actors.C);
    expect(ownCode !== recipientCode).toBe(true);
    const b = await provider(actors.B);
    const c = await provider(actors.C);
    for (const actorPage of [page, recipientPage, outsiderPage]) {
      const baseline = await data<SigningPage<SigningDocument>>(
        actorPage.request,
        "/api/v2/signing-documents",
      );
      expect(baseline.items.length).toBe(0);
    }
    await checked(
      "three_verified_normal_user_logins_codes_and_empty_new_model",
    );

    stage = "private_draft_upload";
    const categories = await data<Category[]>(
      page.request,
      "/api/v1/categories",
    );
    const category = categories.find((item) => item.slug === "pendidikan");
    if (!category)
      throw new Error("The approved Pendidikan category is unavailable.");
    const title = `UJI DEVELOPMENT — Persetujuan internal — ${runId}`;
    const file = {
      name: "uji-signing-development.pdf",
      mimeType: "application/pdf",
      buffer: fixture,
    };
    await page.goto("/signing/new");
    await page.getByLabel(/^Judul dokumen\s*\*?$/).fill(title);
    await page.getByLabel(/^Kategori\s*\*?$/).selectOption(category.id);
    await page
      .getByLabel("Pilih PDF draft", { exact: true })
      .setInputFiles(file);
    await page
      .getByRole("checkbox", { name: SIGNING_UPLOAD_CONSENT_TEXT, exact: true })
      .check();
    const uploadedPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v2/signing-documents" &&
        response.request().method() === "POST",
      { timeout: 50_000 },
    );
    await page
      .getByRole("button", { name: "Simpan draft privat", exact: true })
      .click();
    const uploaded = await uploadedPromise;
    expect(uploaded.status(), "The synthetic draft must commit").toBe(201);
    const draft = ((await uploaded.json()) as { data: DraftReceipt }).data;
    if (!uuid.test(draft.documentId) || !uuid.test(draft.versionId))
      throw new Error(
        "The server did not return a reconcilable draft receipt.",
      );
    receipt = {
      documentId: draft.documentId,
      versionId: draft.versionId,
      status: "draft",
    };
    await saveProof();
    expect(draft.versionNo).toBe(1);
    expect(draft.status).toBe("draft");
    assertSafeDto(draft);
    const source = `/api/v2/signing-documents/${draft.documentId}/file?versionId=${draft.versionId}`;
    const documentPath = `/api/v2/signing-documents/${draft.documentId}`;
    const uploadKey = uploaded.request().headers()["idempotency-key"];
    if (!uploadKey || !uuid.test(uploadKey))
      throw new Error("The application's upload key was not captured.");
    const multipart = {
      title,
      categoryId: category.id,
      policyVersion: SIGNING_UPLOAD_POLICY_VERSION,
      consent: "true",
      file,
    };
    const repeated = await page.request.post("/api/v2/signing-documents", {
      headers: { Origin: baseURL, "Idempotency-Key": uploadKey },
      multipart,
    });
    privateResponse(repeated, 201);
    expect((await repeated.json()).data).toEqual(draft);
    const conflict = await page.request.post("/api/v2/signing-documents", {
      headers: { Origin: baseURL, "Idempotency-Key": uploadKey },
      multipart: { ...multipart, title: `${title} changed` },
    });
    privateResponse(conflict, 409);
    expect((await conflict.json()).error?.code).toBe("IDEMPOTENCY_CONFLICT");
    for (const request of [recipient.request, outsider.request]) {
      privateResponse(await request.get(documentPath), 404);
      privateResponse(await request.get(source), 404);
    }
    const hiddenBefore = await b.client
      .from("signing_document_versions")
      .select("id")
      .eq("id", draft.versionId);
    expect(Boolean(hiddenBefore.error)).toBe(false);
    expect(hiddenBefore.data?.length).toBe(0);
    await checked(
      "one_private_draft_immutable_receipt_retry_and_preinvite_denial",
    );

    stage = "recipient_lookup_and_invitation";
    await expect(page).toHaveURL(
      (url) => url.pathname === `/signing/documents/${draft.documentId}`,
      { timeout: 20_000 },
    );
    const self = await page.request.post("/api/v2/recipients/lookup", {
      headers: { Origin: baseURL },
      data: { code: ownCode },
    });
    privateResponse(self, 404);
    expect((await self.json()).error?.code).toBe("RECIPIENT_UNAVAILABLE");
    await page
      .getByLabel("Kode pengguna penerima", { exact: true })
      .fill(recipientCode);
    const lookupPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v2/recipients/lookup" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Temukan penerima", exact: true })
      .click();
    const lookup = await lookupPromise;
    privateResponse(lookup, 200);
    const candidate = (await lookup.json()).data;
    expect(candidate.id).toBe(actors.B.id);
    expect(candidate.code === recipientCode).toBe(true);
    expect(Object.keys(candidate).sort()).toEqual([
      "code",
      "displayName",
      "id",
    ]);
    await page
      .getByRole("button", { name: "Gunakan penerima ini", exact: true })
      .click();
    await page
      .getByRole("checkbox", {
        name: SIGNING_SHARING_CONSENT_TEXT,
        exact: true,
      })
      .check();
    const sentPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v2/signing-requests" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Kirim permintaan", exact: true })
      .click();
    const sent = await sentPromise;
    privateResponse(sent, 201);
    const invitation = ((await sent.json()) as { data: SigningRequestReceipt })
      .data;
    if (!uuid.test(invitation.requestId))
      throw new Error("The request receipt is unavailable for reconciliation.");
    receipt.requestId = invitation.requestId;
    receipt.status = "pending";
    await saveProof();
    expect(invitation.documentId).toBe(draft.documentId);
    expect(invitation.sourceVersionId).toBe(draft.versionId);
    expect(invitation.status).toBe("pending");
    expect(
      Date.parse(invitation.expiresAt) - Date.parse(invitation.sentAt),
    ).toBe(168 * 60 * 60 * 1000);
    const sendKey = sent.request().headers()["idempotency-key"];
    const sendBody: unknown = sent.request().postDataJSON();
    if (!sendKey || !uuid.test(sendKey))
      throw new Error("The application's request key was not captured.");
    const retry = await page.request.post("/api/v2/signing-requests", {
      headers: { Origin: baseURL, "Idempotency-Key": sendKey },
      data: sendBody as Record<string, unknown>,
    });
    privateResponse(retry, 201);
    expect((await retry.json()).data).toEqual(invitation);
    await checked(
      "exact_recipient_lookup_explicit_sharing_and_single_idempotent_168h_request",
    );

    stage = "participant_read_access";
    const requestPath = `/api/v2/signing-requests/${invitation.requestId}`;
    await expect(page).toHaveURL(
      (url) => url.pathname === `/requests/${invitation.requestId}`,
      { timeout: 20_000 },
    );
    await recipientPage.goto("/requests/incoming");
    await expect(
      recipientPage.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await recipientPage.getByRole("link", { name: title, exact: true }).click();
    await expect(
      recipientPage.getByRole("heading", {
        name: "Detail permintaan",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      recipientPage.getByRole("link", { name: "Pratinjau PDF", exact: true }),
    ).toBeVisible();
    const received = await data<{
      request: SigningRequest;
      document: SigningDocument | null;
    }>(recipient.request, requestPath);
    expect(received.request.canReadFile).toBe(true);
    expect(received.document?.versionId).toBe(draft.versionId);
    expect(received.document?.sha256).toBe(fixtureSha256);
    assertSafeDto(received);
    const visible = await b.client
      .from("signing_document_versions")
      .select("id")
      .eq("id", draft.versionId);
    expect(Boolean(visible.error)).toBe(false);
    expect(visible.data?.map((row) => row.id)).toEqual([draft.versionId]);
    for (const request of [page.request, recipient.request]) {
      for (const path of [source, `${source}&download=1`]) {
        const response = await request.get(path);
        privateResponse(response, 200);
        expect(
          createHash("sha256")
            .update(await response.body())
            .digest("hex"),
        ).toBe(fixtureSha256);
        expect(response.headers()["content-type"]).toContain("application/pdf");
        expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
        expect(response.headers()["referrer-policy"]).toBe("no-referrer");
        if (path.endsWith("download=1"))
          expect(response.headers()["content-disposition"]).toContain(
            "attachment;",
          );
      }
    }
    const range = await recipient.request.get(source, {
      headers: { Range: "bytes=0-15" },
    });
    privateResponse(range, 206);
    expect(range.headers()["content-range"]).toBe(
      `bytes 0-15/${fixture.byteLength}`,
    );
    expect((await range.body()).equals(fixture.subarray(0, 16))).toBe(true);
    await checked(
      "recipient_exact_version_rls_private_download_range_and_source_hash",
    );

    stage = "unrelated_and_direct_access_denial";
    for (const path of [documentPath, source, requestPath]) {
      privateResponse(await outsider.request.get(path), 404);
      privateResponse(await guest.get(path), 401);
    }
    const foreignVersions = await c.client
      .from("signing_document_versions")
      .select("id")
      .eq("id", draft.versionId);
    expect(Boolean(foreignVersions.error)).toBe(false);
    expect(foreignVersions.data?.length).toBe(0);
    const foreignRequests = await c.client
      .from("signing_requests")
      .select("id")
      .eq("id", invitation.requestId);
    expect(Boolean(foreignRequests.error)).toBe(false);
    expect(foreignRequests.data?.length).toBe(0);
    const directPath = `${actors.A.id}/signing/${draft.documentId}/${draft.versionId}.pdf`;
    for (const client of [b.client, c.client]) {
      const direct = await client.storage
        .from("document-submissions")
        .download(directPath);
      expect(Boolean(direct.data)).toBe(false);
      expect(Boolean(direct.error)).toBe(true);
    }
    const publicFile = await fetch(
      `${new URL(providerUrl).origin}/storage/v1/object/public/document-submissions/${directPath}`,
      { redirect: "error", signal: AbortSignal.timeout(15_000) },
    ).catch(() => {
      throw new Error("The public Storage boundary could not be checked.");
    });
    expect(publicFile.ok).toBe(false);
    // NULL actor guarantees these probes cannot write even if a grant regresses.
    for (const actor of [b, c]) {
      const response = await fetch(
        `${new URL(providerUrl).origin}/rest/v1/rpc/cancel_signing_request`,
        {
          method: "POST",
          headers: {
            apikey: publicKey,
            Authorization: `Bearer ${actor.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_actor_id: null, p_request_id: null }),
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        },
      ).catch(() => {
        throw new Error("The direct RPC boundary could not be checked.");
      });
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.code).toBe("42501");
      expect(body.message).toBe(
        "permission denied for function cancel_signing_request",
      );
    }
    const nonOwnerCancel = await recipient.request.post(
      `${requestPath}/cancel`,
      { headers: { Origin: baseURL } },
    );
    privateResponse(nonOwnerCancel, 404);
    await checked(
      "unrelated_guest_direct_storage_and_direct_mutation_rpc_denials",
    );

    stage = "native_pdf_preview";
    const [preview, previewResponse] = await Promise.all([
      recipientPage.waitForEvent("popup", { timeout: 20_000 }),
      recipient.waitForEvent("response", {
        predicate: (response) =>
          new URL(response.url()).pathname === `${documentPath}/file`,
        timeout: 20_000,
      }),
      recipientPage
        .getByRole("link", { name: "Pratinjau PDF", exact: true })
        .click(),
    ]);
    try {
      expect([200, 206].includes(previewResponse.status())).toBe(true);
      await preview.waitForLoadState("load", { timeout: 20_000 });
      await expect
        .poll(
          async () => {
            const viewer = preview
              .frames()
              .find((frame) =>
                frame
                  .url()
                  .startsWith(
                    "chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/",
                  ),
              );
            return viewer
              ? viewer
                  .locator("pdf-viewer")
                  .isVisible()
                  .catch(() => false)
              : false;
          },
          { timeout: 20_000 },
        )
        .toBe(true);
      await checked("recipient_native_pdf_viewer_loaded_without_bearer_url");
    } finally {
      await preview.close();
    }

    stage = "owner_cancellation_and_revocation";
    await page
      .getByRole("button", { name: "Batalkan permintaan", exact: true })
      .click();
    const cancelledPromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `${requestPath}/cancel` &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Ya, batalkan permintaan", exact: true })
      .click();
    const cancelled = await cancelledPromise;
    privateResponse(cancelled, 200);
    const cancellation = (
      (await cancelled.json()) as { data: SigningRequestReceipt }
    ).data;
    receipt.status = "cancelled";
    await saveProof();
    expect(cancellation.requestId).toBe(invitation.requestId);
    expect(cancellation.status).toBe("cancelled");
    const cancelRetry = await page.request.post(`${requestPath}/cancel`, {
      headers: { Origin: baseURL },
    });
    privateResponse(cancelRetry, 200);
    expect((await cancelRetry.json()).data).toEqual(cancellation);
    await recipientPage.reload();
    await expect(
      recipientPage.getByRole("heading", {
        name: "Akses dokumen telah berakhir",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      recipientPage.getByRole("link", { name: "Pratinjau PDF", exact: true }),
    ).toHaveCount(0);
    privateResponse(await recipient.request.get(source), 404);
    privateResponse(await recipient.request.get(documentPath), 404);
    const ended = await data<{
      request: SigningRequest;
      document: SigningDocument | null;
    }>(recipient.request, requestPath);
    expect(ended.request.status).toBe("cancelled");
    expect(ended.request.canReadFile).toBe(false);
    expect(ended.request.documentTitle).toBeNull();
    expect(ended.document).toBeNull();
    const hiddenAfter = await b.client
      .from("signing_document_versions")
      .select("id")
      .eq("id", draft.versionId);
    expect(Boolean(hiddenAfter.error)).toBe(false);
    expect(hiddenAfter.data?.length).toBe(0);
    const ownerFile = await page.request.get(source);
    privateResponse(ownerFile, 200);
    expect(
      createHash("sha256")
        .update(await ownerFile.body())
        .digest("hex"),
    ).toBe(fixtureSha256);
    const ownerList = await data<SigningPage<SigningDocument>>(
      page.request,
      "/api/v2/signing-documents",
    );
    const sentList = await data<SigningPage<SigningRequest>>(
      page.request,
      "/api/v2/signing-requests?scope=sent",
    );
    const incomingList = await data<SigningPage<SigningRequest>>(
      recipient.request,
      "/api/v2/signing-requests?scope=received",
    );
    expect(ownerList.items.map((item) => item.id)).toEqual([draft.documentId]);
    expect(sentList.items.map((item) => item.id)).toEqual([
      invitation.requestId,
    ]);
    expect(incomingList.items.map((item) => item.id)).toEqual([
      invitation.requestId,
    ]);
    expect(incomingList.items[0]?.documentTitle).toBeNull();
    await checked(
      "owner_cancel_retry_recipient_revocation_history_and_unchanged_source",
    );
    status = "passed";
    stage = "complete";
    await saveProof();
  } catch {
    status = "failed";
    await saveProof().catch(() => {});
    // Never attach provider errors, HTTP bodies, cookies or credential call logs.
    throw new Error(
      `Signing acceptance failed during ${stage}; safe proof retained.`,
    );
  } finally {
    for (const client of providers)
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    await recipient.close();
    await outsider.close();
    await guest.dispose();
  }
});
