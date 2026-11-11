import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import {
  test,
  expect,
  type Page,
  type APIResponse,
  type APIRequestContext,
} from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import jsQR from "jsqr";
import type { Database } from "../../src/types/database";
import type { Category } from "../../src/server/workspace/types";
import type {
  SigningDocument,
  SigningRequest,
  SigningRequestReceipt,
} from "../../src/server/signing/types";
import type {
  SigningEvidence,
  SigningDecision,
} from "../../src/lib/signing/evidence-types";
import {
  SIGNING_UPLOAD_CONSENT_TEXT,
  SIGNING_SHARING_CONSENT_TEXT,
  SIGNING_ACTION_CONSENT_TEXT,
  SIGNING_ACTION_POLICY_VERSION,
} from "../../src/lib/signing/policy";

// Opt-in only. Import/listing creates no fixtures and makes no provider calls.
test.use({ trace: "off", screenshot: "off", video: "off" });
const { PNG } = createRequire(import.meta.url)("pngjs") as {
  PNG: {
    sync: {
      read(bytes: Buffer): { width: number; height: number; data: Uint8Array };
    };
  };
};
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fixtureSha256 =
  "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
type Account = { id: string; email: string; password: string };
type Receipt = {
  documentId: string;
  versionId: string;
  requestId?: string;
  decisionId?: string;
  receiptId?: string;
  status: string;
};
type DecisionResult = {
  decisionId: string;
  requestId: string;
  sourceVersionId: string;
  action: "approve" | "reject";
  reason: string | null;
  receiptId: string | null;
  artifactState: string | null;
};
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
function safeDto(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /"(?:storage_path|storagePath|claimToken|confirmation_digest|session_id|access_token|refresh_token)"/,
  );
}
function account(kind: "A" | "B" | "C", runId: string): Account {
  const prefix = `DVP_SIGNING_R3_CLOUD_${kind}_`,
    id = process.env[`${prefix}ID`],
    email = process.env[`${prefix}EMAIL`],
    password = process.env[`${prefix}PASSWORD`];
  if (
    !id ||
    !uuid.test(id) ||
    !email?.endsWith("@example.invalid") ||
    !email.includes(runId) ||
    !password
  )
    throw new Error("Exact synthetic R3 account configuration is required.");
  return { id, email, password };
}
async function login(page: Page, actor: Account) {
  try {
    await page.goto("/login?next=%2Fprofile");
    await page.getByLabel(/^Email\s*\*?$/).fill(actor.email);
    await page.getByLabel(/^Kata sandi\s*\*?$/).fill(actor.password);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/profile", {
      timeout: 25000,
    });
  } catch {
    throw new Error("Synthetic R3 login failed; credentials omitted.");
  }
  const me = await data<{
    user: { id: string; emailConfirmed: boolean };
    roles: string[];
  }>(page.request, "/api/v1/me");
  expect(me.user.id).toBe(actor.id);
  expect(me.user.emailConfirmed).toBe(true);
  expect(me.roles).toEqual(["user"]);
  const code = await data<{ code: string }>(
    page.request,
    "/api/v2/me/user-code",
  );
  expect(/^DVP-[A-F0-9]{20}$/.test(code.code)).toBe(true);
  return code.code;
}

test("two synthetic requests prove internal approval QR and private rejection", async ({
  page,
  browser,
  playwright,
  baseURL,
}, testInfo) => {
  test.setTimeout(360000);
  test.skip(
    process.env.DVP_SIGNING_R3_CLOUD_TEST !== "1",
    "Requires separately approved persistent R3 fixtures and its dedicated runner.",
  );
  const runId = process.env.DVP_SIGNING_R3_CLOUD_RUN_ID,
    configuredProof = process.env.DVP_SIGNING_R3_CLOUD_PROOF,
    providerUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (
    !runId ||
    !uuid.test(runId) ||
    !configuredProof ||
    !providerUrl ||
    !publicKey ||
    !baseURL
  )
    throw new Error("Exact R3 runner configuration is required.");
  const proofPath = resolve(configuredProof);
  if (
    proofPath !== resolve("test-results", `cloud-signing-r3-${runId}.json`) ||
    !proofPath.startsWith(`${resolve("test-results")}${sep}`)
  )
    throw new Error("R3 proof must match the exact workspace run path.");
  const actors = {
    A: account("A", runId),
    B: account("B", runId),
    C: account("C", runId),
  };
  if (new Set(Object.values(actors).map((actor) => actor.id)).size !== 3)
    throw new Error("Three distinct R3 accounts are required.");
  const fixture = await readFile(
    resolve("tests/fixtures/phase-3-development.pdf"),
  );
  expect(fixture.length).toBe(2831);
  expect(createHash("sha256").update(fixture).digest("hex")).toBe(
    fixtureSha256,
  );
  const receipts: Partial<Record<"approve" | "reject", Receipt>> = {},
    checks: string[] = [];
  let status: "running" | "passed" | "failed" = "running",
    stage = "synthetic_login";
  async function saveProof() {
    const prior = JSON.parse(await readFile(proofPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (prior.schemaVersion !== 3 || prior.runId !== runId)
      throw new Error("R3 proof marker mismatch.");
    const temporary = `${proofPath}.browser.tmp`;
    await mkdir(dirname(proofPath), { recursive: true });
    await writeFile(
      temporary,
      `${JSON.stringify({ ...prior, schemaVersion: 3, runId, status, receipts, checks, stage }, null, 2)}\n`,
      { mode: 0o600 },
    );
    await rename(temporary, proofPath);
  }
  async function checked(name: string) {
    checks.push(name);
    await saveProof();
  }
  const recipient = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 1000 },
    }),
    outsider = await browser.newContext({ baseURL }),
    guest = await playwright.request.newContext({ baseURL });
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
              signal: AbortSignal.timeout(15000),
            });
          } catch {
            throw new Error("Synthetic provider request failed.");
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
        throw new Error("Authentication failed.");
      return { client, accessToken: signed.data.session.access_token };
    } catch {
      throw new Error(
        "Synthetic R3 provider login failed; credentials omitted.",
      );
    }
  }
  const requestPath = (item: Receipt) =>
    `/api/v2/signing-requests/${item.requestId}`;
  const sourcePath = (item: Receipt) =>
    `/api/v2/signing-documents/${item.documentId}/file?versionId=${item.versionId}`;
  const payload = (item: Receipt) => ({
    action: "approve",
    sourceVersionId: item.versionId,
    sourceSha256: fixtureSha256,
    policyVersion: SIGNING_ACTION_POLICY_VERSION,
    confirmed: true,
    consent: true,
  });
  async function postDecision(
    request: APIRequestContext,
    item: Receipt,
    input: unknown,
    key: string = randomUUID(),
  ) {
    return request.post(`${requestPath(item)}/decisions`, {
      headers: { Origin: baseURL!, "Idempotency-Key": key },
      data: input as Record<string, unknown>,
      timeout: 120000,
    });
  }
  try {
    const recipientPage = await recipient.newPage(),
      outsiderPage = await outsider.newPage();
    await login(page, actors.A);
    const recipientCode = await login(recipientPage, actors.B);
    await login(outsiderPage, actors.C);
    const b = await provider(actors.B),
      c = await provider(actors.C);
    for (const actorPage of [page, recipientPage, outsiderPage])
      expect(
        (
          await data<{ items: SigningDocument[] }>(
            actorPage.request,
            "/api/v2/signing-documents",
          )
        ).items,
      ).toHaveLength(0);
    await checked("three_verified_normal_user_logins_and_empty_new_model");
    const category = (
      await data<Category[]>(page.request, "/api/v1/categories")
    ).find((item) => item.slug === "pendidikan");
    if (!category) throw new Error("Approved category unavailable.");
    async function draftAndInvite(action: "approve" | "reject") {
      stage = `${action}_draft_and_invitation`;
      const title = `UJI DEVELOPMENT R3 ${action} ${runId}`;
      await page.goto("/signing/new");
      await page.getByLabel(/^Judul dokumen\s*\*?$/).fill(title);
      await page.getByLabel(/^Kategori\s*\*?$/).selectOption(category!.id);
      await page.getByLabel("Pilih PDF draft", { exact: true }).setInputFiles({
        name: "uji-signing-r3.pdf",
        mimeType: "application/pdf",
        buffer: fixture,
      });
      await page
        .getByRole("checkbox", {
          name: SIGNING_UPLOAD_CONSENT_TEXT,
          exact: true,
        })
        .check();
      const uploadedPromise = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === "/api/v2/signing-documents" &&
          response.request().method() === "POST",
        { timeout: 50000 },
      );
      await page
        .getByRole("button", { name: "Simpan draft privat", exact: true })
        .click();
      const uploaded = await uploadedPromise;
      privateResponse(uploaded, 201);
      const draft = (await uploaded.json()).data as {
        documentId: string;
        versionId: string;
        status: string;
      };
      if (!uuid.test(draft.documentId) || !uuid.test(draft.versionId))
        throw new Error("Reconcilable R3 draft receipt unavailable.");
      const item: Receipt = {
        documentId: draft.documentId,
        versionId: draft.versionId,
        status: "draft",
      };
      receipts[action] = item;
      await saveProof();
      safeDto(draft);
      for (const request of [recipient.request, outsider.request])
        privateResponse(await request.get(sourcePath(item)), 404);
      await expect(page).toHaveURL(
        (url) => url.pathname === `/signing/documents/${item.documentId}`,
        { timeout: 20000 },
      );
      await page
        .getByLabel("Kode pengguna penerima", { exact: true })
        .fill(recipientCode);
      await page
        .getByRole("button", { name: "Temukan penerima", exact: true })
        .click();
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
      const invitation = (await sent.json()).data as SigningRequestReceipt;
      if (!uuid.test(invitation.requestId))
        throw new Error("Reconcilable R3 invitation receipt unavailable.");
      item.requestId = invitation.requestId;
      item.status = "pending";
      await saveProof();
      expect(invitation.sourceVersionId).toBe(item.versionId);
      expect(invitation.documentId).toBe(item.documentId);
      expect(invitation.status).toBe("pending");
      await expect(page).toHaveURL(
        (url) => url.pathname === `/requests/${item.requestId}`,
        { timeout: 20000 },
      );
      for (const request of [page.request, recipient.request]) {
        const outcome = await data<{
          decision: SigningDecision | null;
          evidence: SigningEvidence | null;
        }>(request, `${requestPath(item)}/decision`);
        expect(outcome).toEqual({ decision: null, evidence: null });
        const source = await request.get(sourcePath(item));
        privateResponse(source, 200);
        expect(
          createHash("sha256")
            .update(await source.body())
            .digest("hex"),
        ).toBe(fixtureSha256);
      }
      const before = await b.client
        .from("signing_receipts")
        .select("id")
        .eq("request_id", item.requestId);
      expect(Boolean(before.error)).toBe(false);
      expect(before.data).toHaveLength(0);
      return { item, title };
    }
    const approved = await draftAndInvite("approve"),
      rejected = await draftAndInvite("reject");
    await checked(
      "two_private_frozen_versions_invited_to_one_recipient_without_receipts",
    );

    stage = "decision_authorization_and_version_binding";
    for (const request of [page.request, outsider.request])
      privateResponse(
        await postDecision(request, approved.item, payload(approved.item)),
        404,
      );
    privateResponse(
      await guest.post(`${requestPath(approved.item)}/decisions`, {
        headers: { Origin: baseURL },
        data: payload(approved.item),
      }),
      401,
    );
    for (const extra of [
      { actor_id: actors.B.id },
      { confirmed: false },
      { consent: false },
      { policyVersion: "wrong" },
    ])
      privateResponse(
        await postDecision(recipient.request, approved.item, {
          ...payload(approved.item),
          ...extra,
        }),
        422,
      );
    privateResponse(
      await postDecision(recipient.request, approved.item, {
        ...payload(approved.item),
        sourceVersionId: rejected.item.versionId,
      }),
      409,
    );
    privateResponse(
      await postDecision(recipient.request, approved.item, {
        ...payload(approved.item),
        sourceSha256: "f".repeat(64),
      }),
      409,
    );
    privateResponse(
      await recipient.request.post(`${requestPath(approved.item)}/decisions`, {
        headers: {
          Origin: "https://attacker.example",
          "Idempotency-Key": randomUUID(),
        },
        data: payload(approved.item),
      }),
      403,
    );
    expect(
      (
        await data<{ decision: SigningDecision | null }>(
          recipient.request,
          `${requestPath(approved.item)}/decision`,
        )
      ).decision,
    ).toBeNull();
    for (const actor of [b, c]) {
      const hidden = await actor.client
        .from("signing_decisions")
        .select("id")
        .eq("request_id", approved.item.requestId!);
      expect(Boolean(hidden.error)).toBe(false);
      expect(hidden.data).toHaveLength(0);
      const rpc = await fetch(
        `${new URL(providerUrl).origin}/rest/v1/rpc/claim_signing_render`,
        {
          method: "POST",
          headers: {
            apikey: publicKey,
            Authorization: `Bearer ${actor.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ p_actor_id: null, p_receipt_id: null }),
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        },
      );
      expect(rpc.status).toBe(403);
      expect((await rpc.json()).message).toBe(
        "permission denied for function claim_signing_render",
      );
    }
    await checked(
      "owner_outsider_guest_injection_origin_and_stale_version_decisions_denied",
    );

    stage = "explicit_approval_without_password_reauthentication";
    await recipientPage.goto(`/requests/${approved.item.requestId}`);
    await expect(
      recipientPage.getByRole("button", {
        name: "Setujui dokumen",
        exact: true,
      }),
    ).toBeVisible();
    await recipientPage
      .getByRole("button", { name: "Setujui dokumen", exact: true })
      .click();
    const dialog = recipientPage.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: "Setujui versi dokumen ini?",
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    const consent = dialog.getByRole("checkbox", {
      name: SIGNING_ACTION_CONSENT_TEXT,
      exact: true,
    });
    await expect(consent).not.toBeChecked();
    let decisionPosts = 0;
    recipientPage.on("request", (request) => {
      if (
        new URL(request.url()).pathname ===
          `${requestPath(approved.item)}/decisions` &&
        request.method() === "POST"
      )
        decisionPosts++;
    });
    await dialog
      .getByRole("button", { name: "Ya, setujui versi ini", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Centang pernyataan persetujuan",
    );
    expect(decisionPosts).toBe(0);
    await consent.check();
    const decidedPromise = recipientPage.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `${requestPath(approved.item)}/decisions` &&
        response.request().method() === "POST",
      { timeout: 120000 },
    );
    await dialog
      .getByRole("button", { name: "Ya, setujui versi ini", exact: true })
      .click();
    const decided = await decidedPromise;
    privateResponse(decided, 201);
    const result = (await decided.json()).data as DecisionResult;
    if (
      !uuid.test(result.decisionId) ||
      !result.receiptId ||
      !/^[A-Za-z0-9_-]{43}$/.test(result.receiptId)
    )
      throw new Error("Reconcilable approval receipt unavailable.");
    Object.assign(approved.item, {
      decisionId: result.decisionId,
      receiptId: result.receiptId,
      status: "consented",
    });
    await saveProof();
    expect(result.requestId).toBe(approved.item.requestId);
    expect(result.action).toBe("approve");
    expect(result.reason).toBeNull();
    safeDto(result);
    const decisionKey = decided.request().headers()["idempotency-key"],
      decisionBody = decided.request().postDataJSON() as Record<
        string,
        unknown
      >;
    if (!uuid.test(decisionKey ?? ""))
      throw new Error("Application decision key not captured.");
    const evidencePath = `/api/v2/signing-receipts/${result.receiptId}`,
      receiptHref = `/receipts/${result.receiptId}`;
    await expect(recipientPage).toHaveURL(
      (url) => url.pathname === receiptHref,
      { timeout: 20000 },
    );
    let evidence = await data<SigningEvidence>(recipient.request, evidencePath);
    if (evidence.artifact.state !== "ready") {
      await recipientPage
        .getByRole("button", { name: "Periksa & siapkan PDF", exact: true })
        .click();
      await expect(
        recipientPage.getByRole("link", {
          name: "Unduh PDF ber-QR",
          exact: true,
        }),
      ).toBeVisible({ timeout: 60000 });
    }
    evidence = await data<SigningEvidence>(recipient.request, evidencePath);
    expect(evidence.artifact.state).toBe("ready");
    expect(evidence.artifact.pageCount).toBe(2);
    expect(evidence.sourceSha256).toBe(fixtureSha256);
    expect(evidence.signerCode === recipientCode).toBe(true);
    expect(evidence.decisionId).toBe(result.decisionId);
    safeDto(evidence);
    approved.item.status = "completed";
    await saveProof();
    const retry = await postDecision(
      recipient.request,
      approved.item,
      decisionBody,
      decisionKey,
    );
    privateResponse(retry, 201);
    const repeated = (await retry.json()).data as DecisionResult;
    expect(repeated.decisionId).toBe(result.decisionId);
    expect(repeated.receiptId).toBe(result.receiptId);
    privateResponse(
      await postDecision(
        recipient.request,
        approved.item,
        {
          ...payload(approved.item),
          action: "reject",
          consent: false,
          reason: "Changed decision",
        },
        decisionKey,
      ),
      409,
    );
    privateResponse(
      await page.request.post(`${requestPath(approved.item)}/cancel`, {
        headers: { Origin: baseURL },
      }),
      409,
    );
    await checked(
      "unchecked_consent_no_password_committed_approval_single_receipt_and_retry",
    );

    stage = "private_result_byte_integrity_and_scope";
    const resultPath = `${evidencePath}/file`;
    let output: Buffer | undefined;
    for (const request of [page.request, recipient.request]) {
      const receipt = await data<SigningEvidence>(request, evidencePath);
      expect(receipt.id).toBe(result.receiptId);
      safeDto(receipt);
      const response = await request.get(resultPath);
      privateResponse(response, 200);
      expect(response.headers()["content-type"]).toContain("application/pdf");
      expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
      const bytes = await response.body();
      expect(bytes.length).toBe(evidence.artifact.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        evidence.artifact.sha256,
      );
      expect(bytes.equals(fixture)).toBe(false);
      output = bytes;
      const source = await request.get(sourcePath(approved.item));
      privateResponse(source, 200);
      expect((await source.body()).equals(fixture)).toBe(true);
    }
    if (!output) throw new Error("Derived PDF bytes unavailable.");
    expect((await PDFDocument.load(output)).getPageCount()).toBe(2);
    const ranged = await recipient.request.get(resultPath, {
      headers: { Range: "bytes=0-15" },
    });
    privateResponse(ranged, 206);
    expect((await ranged.body()).equals(output.subarray(0, 16))).toBe(true);
    expect(ranged.headers()["content-range"]).toBe(
      `bytes 0-15/${output.length}`,
    );
    const download = await page.request.get(`${resultPath}?download=1`);
    privateResponse(download, 200);
    expect(download.headers()["content-disposition"]).toContain("attachment;");
    for (const path of [
      evidencePath,
      resultPath,
      `${requestPath(approved.item)}/decision`,
    ]) {
      privateResponse(await outsider.request.get(path), 404);
      privateResponse(await guest.get(path), 401);
    }
    privateResponse(
      await outsider.request.post(`${evidencePath}/render`, {
        headers: { Origin: baseURL },
      }),
      404,
    );
    const foreignReceipt = await c.client
      .from("signing_receipts")
      .select("id")
      .eq("id", result.receiptId);
    expect(Boolean(foreignReceipt.error)).toBe(false);
    expect(foreignReceipt.data).toHaveLength(0);
    const foreignPage = await outsiderPage.goto(receiptHref);
    // A streamed notFound() page keeps its initial 200 status in Next.js.
    // The API must still return 404 and the rendered page must disclose no
    // receipt, source metadata or QR to the unrelated authenticated user.
    expect([200, 404].includes(foreignPage?.status() ?? 0)).toBe(true);
    await expect(
      outsiderPage.getByRole("heading", {
        name: "Bukti tidak ditemukan",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      outsiderPage.getByRole("img", {
        name: "QR tautan bukti persetujuan privat",
      }),
    ).toHaveCount(0);
    expect(await outsiderPage.content()).not.toContain(approved.title);
    expect(await outsiderPage.content()).not.toContain(fixtureSha256);
    const guestPage = await guest.get(receiptHref, { maxRedirects: 0 });
    expect([307, 308].includes(guestPage.status())).toBe(true);
    expect(new URL(guestPage.headers().location, baseURL).pathname).toBe(
      "/login",
    );
    const row = await b.client
      .from("signing_artifacts")
      .select("storage_path")
      .eq("receipt_id", result.receiptId)
      .single();
    if (row.error || !row.data.storage_path)
      throw new Error("Authorized result metadata unavailable.");
    const sourceObject = `${actors.A.id}/signing/${approved.item.documentId}/${approved.item.versionId}.pdf`;
    for (const client of [b.client, c.client])
      for (const [bucket, path] of [
        ["document-submissions", sourceObject],
        ["signing-results", row.data.storage_path],
      ]) {
        const direct = await client.storage.from(bucket!).download(path!);
        expect(Boolean(direct.data)).toBe(false);
        expect(Boolean(direct.error)).toBe(true);
      }
    const publicFile = await fetch(
      `${new URL(providerUrl).origin}/storage/v1/object/public/signing-results/${row.data.storage_path}`,
      { redirect: "error", signal: AbortSignal.timeout(15000) },
    );
    expect(publicFile.ok).toBe(false);
    await checked(
      "ready_pdf_hash_range_source_immutability_participant_rls_and_direct_storage_denial",
    );

    stage = "qr_from_both_actual_pdf_pages";
    const previewContext = await browser.newContext({
      baseURL,
      storageState: await recipient.storageState(),
      viewport: { width: 1200, height: 1050 },
      deviceScaleFactor: 2,
    });
    try {
      for (const number of [1, 2]) {
        const preview = await previewContext.newPage();
        await preview.goto(`${resultPath}#page=${number}&zoom=75`);
        let decoded = false;
        await expect
          .poll(
            async () => {
              const screenshot = await preview.screenshot();
              const png = PNG.sync.read(screenshot),
                left = Math.floor(png.width * 0.27),
                top = number === 2 ? Math.floor(png.height / 2) : 0,
                width = png.width - left,
                height = png.height - top,
                pixels = new Uint8ClampedArray(width * height * 4);
              for (let y = 0; y < height; y++)
                pixels.set(
                  png.data.subarray(
                    ((y + top) * png.width + left) * 4,
                    ((y + top) * png.width + png.width) * 4,
                  ),
                  y * width * 4,
                );
              const scan = jsQR(pixels, width, height, {
                inversionAttempts: "dontInvert",
              });
              decoded = scan?.data === `${baseURL}${receiptHref}`;
              return decoded;
            },
            { timeout: 20000, intervals: [250, 500, 1000] },
          )
          .toBe(true);
        if (!decoded) throw new Error("Independent PDF QR decoding failed.");
        await preview.screenshot({
          path: testInfo.outputPath(`approved-pdf-page-${number}.png`),
        });
        await preview.close();
      }
    } finally {
      await previewContext.close();
    }
    await checked(
      "both_original_footer_and_evidence_page_qr_decode_to_same_private_receipt",
    );

    stage = "receipt_responsive_light_dark";
    await recipientPage.goto(receiptHref);
    await expect(
      recipientPage.getByRole("heading", {
        name: "Bukti persetujuan",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      recipientPage.getByRole("img", {
        name: "QR tautan bukti persetujuan privat",
        exact: true,
      }),
    ).toBeVisible();
    for (const [theme, width, height] of [
      ["light", 1440, 1000],
      ["dark", 390, 844],
    ] as const) {
      await recipientPage.setViewportSize({ width, height });
      await recipientPage
        .getByLabel("Tema", { exact: true })
        .selectOption(theme);
      await expect(recipientPage.locator("html")).toHaveAttribute(
        "data-theme",
        theme,
      );
      expect(
        await recipientPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await recipientPage.screenshot({
        path: testInfo.outputPath(`receipt-${theme}.png`),
        fullPage: true,
        mask: [recipientPage.locator('header [title*="@"]')],
      });
    }
    await recipientPage.setViewportSize({ width: 1440, height: 1000 });
    await recipientPage
      .getByLabel("Tema", { exact: true })
      .selectOption("light");
    await checked(
      "private_receipt_desktop_mobile_light_dark_without_horizontal_overflow",
    );

    stage = "required_private_rejection_and_revoked_source";
    const reason = "Tidak sesuai kebutuhan uji development R3.",
      rejectBody = {
        ...payload(rejected.item),
        action: "reject",
        consent: false,
        reason,
      };
    for (const invalid of ["", " ", "x".repeat(1001)])
      privateResponse(
        await postDecision(recipient.request, rejected.item, {
          ...rejectBody,
          reason: invalid,
        }),
        422,
      );
    await recipientPage.goto(`/requests/${rejected.item.requestId}`);
    await recipientPage
      .getByRole("button", { name: "Tolak dokumen", exact: true })
      .click();
    const rejectionDialog = recipientPage.getByRole("dialog");
    await expect(rejectionDialog.locator('input[type="password"]')).toHaveCount(
      0,
    );
    const reasonField = rejectionDialog.getByRole("textbox", {
      name: /Alasan penolakan/,
    });
    await expect(reasonField).toHaveAttribute("maxlength", "1000");
    await expect(reasonField).toHaveAttribute("required", "");
    await reasonField.fill(reason);
    const rejectedPromise = recipientPage.waitForResponse(
      (response) =>
        new URL(response.url()).pathname ===
          `${requestPath(rejected.item)}/decisions` &&
        response.request().method() === "POST",
      { timeout: 30000 },
    );
    await rejectionDialog
      .getByRole("button", { name: "Ya, tolak dokumen", exact: true })
      .click();
    const rejectedResponse = await rejectedPromise;
    privateResponse(rejectedResponse, 201);
    const rejection = (await rejectedResponse.json()).data as DecisionResult;
    if (!uuid.test(rejection.decisionId))
      throw new Error("Reconcilable rejection receipt unavailable.");
    Object.assign(rejected.item, {
      decisionId: rejection.decisionId,
      status: "rejected",
    });
    await saveProof();
    expect(rejection.receiptId).toBeNull();
    expect(rejection.artifactState).toBeNull();
    expect(rejection.reason).toBe(reason);
    const rejectKey = rejectedResponse.request().headers()["idempotency-key"];
    if (!uuid.test(rejectKey ?? ""))
      throw new Error("Rejection key unavailable.");
    const rejectRetry = await postDecision(
      recipient.request,
      rejected.item,
      rejectBody,
      rejectKey,
    );
    privateResponse(rejectRetry, 201);
    expect((await rejectRetry.json()).data.decisionId).toBe(
      rejection.decisionId,
    );
    await expect(
      recipientPage.getByRole("heading", {
        name: "Dokumen ditolak",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      recipientPage.getByRole("link", { name: "Pratinjau PDF", exact: true }),
    ).toHaveCount(0);
    await expect(
      recipientPage.getByText(reason, { exact: true }),
    ).toBeVisible();
    for (const request of [page.request, recipient.request]) {
      const outcome = await data<{ decision: SigningDecision; evidence: null }>(
        request,
        `${requestPath(rejected.item)}/decision`,
      );
      expect(outcome.decision.reason).toBe(reason);
      expect(outcome.evidence).toBeNull();
      safeDto(outcome);
    }
    privateResponse(
      await recipient.request.get(sourcePath(rejected.item)),
      404,
    );
    privateResponse(
      await recipient.request.get(
        `/api/v2/signing-documents/${rejected.item.documentId}`,
      ),
      404,
    );
    const ended = await data<{
      request: SigningRequest;
      document: SigningDocument | null;
    }>(recipient.request, requestPath(rejected.item));
    expect(ended.request.status).toBe("rejected");
    expect(ended.request.canReadFile).toBe(false);
    expect(ended.request.documentTitle).toBeNull();
    expect(ended.document).toBeNull();
    const hidden = await b.client
      .from("signing_document_versions")
      .select("id")
      .eq("id", rejected.item.versionId);
    expect(Boolean(hidden.error)).toBe(false);
    expect(hidden.data).toHaveLength(0);
    const noReceipt = await b.client
      .from("signing_receipts")
      .select("id")
      .eq("request_id", rejected.item.requestId!);
    expect(Boolean(noReceipt.error)).toBe(false);
    expect(noReceipt.data).toHaveLength(0);
    privateResponse(
      await outsider.request.get(`${requestPath(rejected.item)}/decision`),
      404,
    );
    const ownerSource = await page.request.get(sourcePath(rejected.item));
    privateResponse(ownerSource, 200);
    expect((await ownerSource.body()).equals(fixture)).toBe(true);
    await checked(
      "required_bounded_reason_rejection_retry_no_receipt_and_recipient_source_revocation",
    );
    status = "passed";
    stage = "complete";
    await saveProof();
  } catch {
    status = "failed";
    await saveProof().catch(() => {});
    throw new Error(
      `R3 acceptance failed during ${stage}; safe proof retained.`,
    );
  } finally {
    for (const client of providers)
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    await recipient.close();
    await outsider.close();
    await guest.dispose();
  }
});
