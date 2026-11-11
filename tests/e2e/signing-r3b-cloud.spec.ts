import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  qrPlanSchema,
  QR_PLACEMENT_VERSION,
  type QrPosition,
} from "../../src/lib/signing/placement";
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
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fixtureSha256 =
  "e3fdf4680cd01b4291822accdcc28f4461f5540bdcd35f82f655fd2fe2313d06";
type Account = { id: string; email: string; password: string };
type Receipt = {
  documentId: string;
  versionId: string;
  requestId?: string;
  decisionId?: string;
  receiptId?: string;
  status: string;
  placements?: QrPosition[];
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
  const prefix = `DVP_SIGNING_R3B_CLOUD_${kind}_`,
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
    throw new Error("Exact synthetic R3b account configuration is required.");
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
    throw new Error("Synthetic R3b login failed; credentials omitted.");
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

test("recipient positions on every source page are locked and scan opens private web evidence", async ({
  page,
  browser,
  playwright,
  baseURL,
}, testInfo) => {
  test.setTimeout(360000);
  test.skip(
    process.env.DVP_SIGNING_R3B_CLOUD_TEST !== "1",
    "Requires separately approved persistent R3b fixtures and its dedicated runner.",
  );
  const runId = process.env.DVP_SIGNING_R3B_CLOUD_RUN_ID,
    configuredProof = process.env.DVP_SIGNING_R3B_CLOUD_PROOF,
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
    throw new Error("Exact R3b runner configuration is required.");
  const proofPath = resolve(configuredProof);
  if (
    proofPath !== resolve("test-results", `cloud-signing-r3b-${runId}.json`) ||
    !proofPath.startsWith(`${resolve("test-results")}${sep}`)
  )
    throw new Error("R3b proof must match the exact workspace run path.");
  const actors = {
    A: account("A", runId),
    B: account("B", runId),
    C: account("C", runId),
  };
  if (new Set(Object.values(actors).map((actor) => actor.id)).size !== 3)
    throw new Error("Three distinct R3b accounts are required.");
  const fixture = await readFile(
    resolve("tests/fixtures/signing-r3b-development.pdf"),
  );
  expect(fixture.length).toBe(1544);
  expect(createHash("sha256").update(fixture).digest("hex")).toBe(
    fixtureSha256,
  );
  const receipts: Partial<Record<"approve", Receipt>> = {},
    checks: string[] = [];
  let status: "running" | "passed" | "failed" = "running",
    stage = "synthetic_login";
  async function saveProof() {
    const prior = JSON.parse(await readFile(proofPath, "utf8")) as Record<
      string,
      unknown
    >;
    if (prior.schemaVersion !== 4 || prior.runId !== runId)
      throw new Error("R3b proof marker mismatch.");
    const temporary = `${proofPath}.browser.tmp`;
    await mkdir(dirname(proofPath), { recursive: true });
    await writeFile(
      temporary,
      `${JSON.stringify({ ...prior, schemaVersion: 4, runId, status, receipts, checks, stage }, null, 2)}\n`,
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
        "Synthetic R3b provider login failed; credentials omitted.",
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
    placementVersion: QR_PLACEMENT_VERSION,
    placements: [
      { page: 1, x: 0.1, y: 0.7 },
      { page: 2, x: 0.65, y: 0.6 },
    ],
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
    async function draftAndInvite(action: "approve") {
      stage = `${action}_draft_and_invitation`;
      const title = `UJI DEVELOPMENT R3b ${action} ${runId}`;
      await page.goto("/signing/new");
      await page.getByLabel(/^Judul dokumen\s*\*?$/).fill(title);
      await page.getByLabel(/^Kategori\s*\*?$/).selectOption(category!.id);
      await page.getByLabel("Pilih PDF draft", { exact: true }).setInputFiles({
        name: "uji-signing-r3b.pdf",
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
        throw new Error("Reconcilable R3b draft receipt unavailable.");
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
        throw new Error("Reconcilable R3b invitation receipt unavailable.");
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
    const approved = await draftAndInvite("approve");
    await checked("one_two_page_private_version_invited_without_receipts");

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
        sourceVersionId: randomUUID(),
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
    privateResponse(
      await postDecision(recipient.request, approved.item, {
        ...payload(approved.item),
        placements: [
          { page: 1, x: 0.99, y: 0.99 },
          { page: 2, x: 0.65, y: 0.6 },
        ],
      }),
      422,
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
    await expect(
      recipientPage.getByRole("button", {
        name: "Setujui dokumen",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      recipientPage.getByRole("img", {
        name: "QR tautan bukti persetujuan privat",
        exact: true,
      }),
    ).toHaveCount(0);
    for (const [number, targetX, targetY] of [
      [1, 0.2, 0.4],
      [2, 0.65, 0.55],
    ] as const) {
      const add = recipientPage.getByRole("button", {
        name: "Letakkan penanda QR",
        exact: true,
      });
      await expect(add).toBeEnabled({ timeout: 30000 });
      await add.click();
      const marker = recipientPage.getByRole("button", {
        name:
          "Posisi QR halaman " +
          number +
          ". Gunakan tombol panah untuk menggeser.",
        exact: true,
      });
      await marker.scrollIntoViewIfNeeded();
      const initial = await marker.boundingBox(),
        sheet = await recipientPage.getByTestId("qr-page-sheet").boundingBox();
      if (!initial || !sheet) throw new Error("Source preview not measurable");
      await recipientPage.mouse.move(
        initial.x + initial.width / 2,
        initial.y + initial.height / 2,
      );
      await recipientPage.mouse.down();
      await recipientPage.mouse.move(
        sheet.x + sheet.width * targetX + initial.width / 2,
        sheet.y + sheet.height * targetY + initial.height / 2,
        { steps: 6 },
      );
      await recipientPage.mouse.up();
      await marker.focus();
      await marker.press("ArrowRight");
      if (number === 1) {
        await expect(
          recipientPage.getByRole("button", {
            name: "Setujui dokumen",
            exact: true,
          }),
        ).toBeDisabled();
        await recipientPage
          .getByRole("button", { name: "Halaman berikutnya", exact: true })
          .click();
      }
    }
    await expect(
      recipientPage.getByText("2 dari 2 halaman sudah diatur", { exact: true }),
    ).toBeVisible();
    await expect(
      recipientPage.getByText("Memuat halaman…", { exact: true }),
    ).toBeHidden();
    await recipientPage.screenshot({
      path: testInfo.outputPath("source-position-editor.png"),
      fullPage: true,
      mask: [recipientPage.locator('header [title*="@"]')],
    });
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
    const selected = decisionBody.placements as QrPosition[];
    expect(decisionBody.placementVersion).toBe(QR_PLACEMENT_VERSION);
    expect(selected).toHaveLength(2);
    expect(selected[0]!.x).not.toBe(selected[1]!.x);
    expect(selected[0]!.y).not.toBe(selected[1]!.y);
    approved.item.placements = selected;
    await saveProof();
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
    expect(evidence.layoutVersion).toBe(QR_PLACEMENT_VERSION);
    expect(
      qrPlanSchema
        .parse(evidence.placements)
        .map(({ page, x, y }) => ({ page, x, y })),
    ).toEqual(
      selected.map(({ page, x, y }) => ({
        page,
        x: Math.floor(x * 1e6) / 1e6,
        y: Math.floor(y * 1e6) / 1e6,
      })),
    );
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
          ...decisionBody,
          placements: selected.map((p, i) =>
            i === 0 ? { ...p, x: p.x + 0.01 } : p,
          ),
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
    const ownLayout = await b.client
      .from("signing_receipt_layouts")
      .select("placement_plan")
      .eq("receipt_id", result.receiptId)
      .single();
    expect(Boolean(ownLayout.error)).toBe(false);
    expect(ownLayout.data?.placement_plan).toEqual(evidence.placements);
    const foreignLayout = await c.client
      .from("signing_receipt_layouts")
      .select("receipt_id")
      .eq("receipt_id", result.receiptId);
    expect(Boolean(foreignLayout.error)).toBe(false);
    expect(foreignLayout.data).toHaveLength(0);
    const changed = await b.client
      .from("signing_receipt_layouts")
      .update({ placement_plan: [] })
      .eq("receipt_id", result.receiptId);
    expect(changed.error?.code).toBe("42501");
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

    stage = "both_source_pages_qr_at_selected_positions_no_appended_proof";
    const rasterTask = getDocument({
      data: new Uint8Array(output),
      standardFontDataUrl:
        resolve("node_modules/pdfjs-dist/standard_fonts") + "/",
      verbosity: 0,
    });
    try {
      const pdf = await rasterTask.promise;
      expect(pdf.numPages).toBe(2);
      const plan = qrPlanSchema.parse(evidence.placements);
      for (const number of [1, 2]) {
        const source = await pdf.getPage(number),
          viewport = source.getViewport({ scale: 1.5 }),
          canvas = createCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
        await source.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport,
        }).promise;
        const pixels = canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height),
          scan = jsQR(pixels.data, canvas.width, canvas.height, {
            inversionAttempts: "dontInvert",
          });
        expect(scan?.data).toBe(baseURL + receiptHref);
        if (!scan) throw new Error("Independent QR decode failed");
        const corners = [
          scan.location.topLeftCorner,
          scan.location.topRightCorner,
          scan.location.bottomLeftCorner,
          scan.location.bottomRightCorner,
        ];
        expect(
          Math.abs(
            corners.reduce((n, p) => n + p.x, 0) / 4 -
              (plan[number - 1]!.x * viewport.width + 67.5),
          ),
        ).toBeLessThan(3);
        expect(
          Math.abs(
            corners.reduce((n, p) => n + p.y, 0) / 4 -
              (plan[number - 1]!.y * viewport.height + 67.5),
          ),
        ).toBeLessThan(3);
        await writeFile(
          testInfo.outputPath("approved-page-" + number + ".png"),
          canvas.toBuffer("image/png"),
        );
      }
      await writeFile(testInfo.outputPath("approved-two-page.pdf"), output);
    } finally {
      await rasterTask.destroy();
    }
    await checked(
      "both_original_pages_qr_match_positions_no_appended_evidence",
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

    status = "passed";
    stage = "complete";
    await saveProof();
  } catch {
    status = "failed";
    await saveProof().catch(() => {});
    throw new Error(
      `R3b acceptance failed during ${stage}; safe proof retained.`,
    );
  } finally {
    for (const client of providers)
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    await recipient.close();
    await outsider.close();
    await guest.dispose();
  }
});
