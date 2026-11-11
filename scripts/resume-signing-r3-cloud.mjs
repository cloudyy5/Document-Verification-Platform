// One reviewed continuation of the exact partial R3 fixture. No new document,
// request, approval, receipt or result object may be created by this script.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  unlink,
} from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { chromium, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const expectedRun = "4d679704-e156-4f55-be23-db7dd80578c4";
const expectedActors = {
  A: "a9cec1cc-8c6d-43d7-8cba-05f2d4b53d13",
  B: "a0c376bf-b5e1-4bcb-85c8-366c5b1f130f",
  C: "196ef9e2-5ac8-4084-abb7-0308c288280a",
};
const expectedRequests = {
  approve: "b8abc527-edf9-8951-aea5-8532f6d8b288",
  reject: "ae236e3e-2c28-8882-b065-1450eaa7a582",
};
const base = "http://127.0.0.1:3100",
  sourceHash =
    "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
const reason = "Tidak sesuai kebutuhan uji development R3.",
  policy = "internal-action-development-2026-11-05";
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const primaryPath = resolve("test-results/cloud-signing-r3-run.json"),
  originalPath = resolve(`test-results/cloud-signing-r3-${expectedRun}.json`),
  resumePath = resolve(
    `test-results/cloud-signing-r3-resume-${expectedRun}.json`,
  ),
  lockPath = resolve("test-results/cloud-signing-r3-resume.lock");
const output = resolve(`test-results/signing-r3-resume/${expectedRun}`);
const record = {
  runId: expectedRun,
  status: "preparing",
  checks: [],
  comparison: { id: expectedActors.C, restoration: "not_requested" },
  receipts: {},
};
let stage = "guard",
  locked = false,
  started = false,
  browser,
  service,
  proof,
  originalBytes;
const sessions = [];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function save() {
  await writeFile(
    `${resumePath}.tmp`,
    JSON.stringify({ ...record, stage }, null, 2) + "\n",
    { mode: 0o600 },
  );
  await rename(`${resumePath}.tmp`, resumePath);
  started = true;
}
async function checked(value) {
  record.checks.push(value);
  await save();
}
function identity(user, kind) {
  return (
    user?.id === expectedActors[kind] &&
    user.email ===
      `dvp-signing-r3-${kind.toLowerCase()}-${expectedRun}@example.invalid` &&
    user.user_metadata?.dvp_test_run === expectedRun &&
    user.user_metadata?.dvp_test_suite === "signing-r3" &&
    user.user_metadata?.dvp_test_actor === kind
  );
}
function privateResponse(response, status) {
  assert.equal(response.status(), status);
  assert.ok(response.headers()["cache-control"]?.includes("no-store"));
  assert.ok(response.headers().vary?.toLowerCase().includes("cookie"));
}
async function json(request, path) {
  const response = await request.get(path, { maxRedirects: 0 });
  privateResponse(response, 200);
  return (await response.json()).data;
}
async function comparisonEmpty() {
  const id = expectedActors.C;
  const probes = await Promise.all([
    service.from("documents").select("id").eq("owner_id", id).limit(1),
    service
      .from("document_submissions")
      .select("id")
      .eq("submitted_by", id)
      .limit(1),
    service.from("signing_documents").select("id").eq("owner_id", id).limit(1),
    service
      .from("signing_document_versions")
      .select("id")
      .eq("owner_id", id)
      .limit(1),
    service
      .from("signing_requests")
      .select("id")
      .or(`owner_id.eq.${id},recipient_id.eq.${id}`)
      .limit(1),
    service.from("signing_decisions").select("id").eq("actor_id", id).limit(1),
    service
      .from("signing_receipts")
      .select("id")
      .or(`owner_id.eq.${id},recipient_id.eq.${id}`)
      .limit(1),
    service.storage.from("document-submissions").list(id, { limit: 1 }),
    service.storage.from("signing-results").list(id, { limit: 1 }),
  ]);
  assert.ok(
    probes.every(
      (result) =>
        !result.error && Array.isArray(result.data) && result.data.length === 0,
    ),
  );
}
async function session(kind, user, config) {
  assert.ok(identity(user, kind));
  // Only these exact synthetic identities can receive a temporary test session.
  // generateLink is consumed in memory; no email, password reset or URL log.
  const link = await service.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  assert.ok(
    !link.error &&
      identity(link.data?.user, kind) &&
      link.data.properties?.hashed_token,
  );
  const cookies = new Map();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: config.global,
      cookies: {
        getAll: () =>
          [...cookies.values()].map(({ name, value }) => ({ name, value })),
        setAll: (items) =>
          items.forEach((item) => cookies.set(item.name, item)),
      },
    },
  );
  const verified = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  assert.ok(!verified.error && identity(verified.data.user, kind));
  sessions.push(client);
  const roles = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  assert.ok(
    !roles.error && roles.data?.length === 1 && roles.data[0].role === "user",
  );
  const context = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1000 },
  });
  await context.addCookies(
    [...cookies.values()]
      .filter((item) => item.value)
      .map((item) => ({
        name: item.name,
        value: item.value,
        domain: "127.0.0.1",
        path: item.options?.path ?? "/",
        sameSite: "Lax",
        secure: false,
        httpOnly: false,
      })),
  );
  assert.equal((await json(context.request, "/api/v1/me")).user.id, user.id);
  return { client, context, page: await context.newPage() };
}

async function main() {
  assert.ok(process.argv.includes("--confirm-existing-fixture"));
  assert.ok(process.argv.includes(`--run=${expectedRun}`));
  proof = JSON.parse(await readFile(primaryPath, "utf8"));
  assert.equal(proof.schemaVersion, 3);
  assert.equal(proof.runId, expectedRun);
  assert.equal(proof.status, "failed_requires_review");
  for (const kind of ["A", "B", "C"])
    assert.equal(proof.accounts?.[kind]?.id, expectedActors[kind]);
  for (const action of ["approve", "reject"])
    assert.equal(proof.receipts?.[action]?.requestId, expectedRequests[action]);
  assert.equal(proof.receipts.approve.status, "completed");
  assert.equal(proof.receipts.reject.status, "pending");
  assert.equal(proof.accounts.C.disposition, "cleaned_up");
  assert.equal(proof.fixtureSha256, sourceHash);
  originalBytes = await readFile(originalPath);
  assert.equal(JSON.parse(originalBytes).status, "failed_requires_review");
  assert.equal(
    process.env.DOCUMENT_ENVIRONMENT ?? "development",
    "development",
  );
  const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  assert.equal(backend.protocol, "https:");
  assert.ok(backend.hostname.endsWith(".supabase.co"));
  assert.equal(backend.pathname, "/");
  assert.ok(
    !backend.username && !backend.password && !backend.search && !backend.hash,
  );
  const lock = await open(lockPath, "wx", 0o600);
  await lock.writeFile(expectedRun);
  await lock.close();
  locked = true;
  const config = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        }),
    },
  };
  service = createClient(
    backend.origin,
    process.env.SUPABASE_SECRET_KEY,
    config,
  );
  stage = "identity_and_immutable_state";
  const users = {};
  for (const kind of ["A", "B"]) {
    const reply = await service.auth.admin.getUserById(expectedActors[kind]);
    assert.ok(!reply.error && identity(reply.data?.user, kind));
    users[kind] = reply.data.user;
  }
  const current = await service
    .from("signing_requests")
    .select("id,owner_id,recipient_id,status,source_version_id,document_id")
    .in("id", Object.values(expectedRequests));
  assert.ok(!current.error && current.data?.length === 2);
  for (const action of ["approve", "reject"]) {
    const row = current.data.find(
      (item) => item.id === expectedRequests[action],
    );
    assert.equal(row.owner_id, expectedActors.A);
    assert.equal(row.recipient_id, expectedActors.B);
    assert.equal(row.source_version_id, proof.receipts[action].versionId);
    assert.equal(row.document_id, proof.receipts[action].documentId);
    assert.equal(row.status, action === "approve" ? "completed" : "pending");
  }
  await comparisonEmpty();
  const oldC = await service.auth.admin.getUserById(expectedActors.C);
  assert.ok(!oldC.data?.user && oldC.error?.status === 404);
  record.originalProofSha256 = hash(originalBytes);
  record.status = "running";
  await save();
  const env = {};
  for (const key of [
    "PATH",
    "SystemRoot",
    "WINDIR",
    "ComSpec",
    "TEMP",
    "TMP",
    "PATHEXT",
    "USERPROFILE",
    "LOCALAPPDATA",
    "APPDATA",
  ])
    if (process.env[key]) env[key] = process.env[key];
  browser = await chromium.launch({ channel: "chromium", headless: true, env });
  const a = await session("A", users.A, config),
    b = await session("B", users.B, config),
    guest = await browser.newContext({ baseURL: base });
  await checked(
    "same_run_and_participant_identities_verified_without_password_reset",
  );
  const approved = proof.receipts.approve,
    rejected = proof.receipts.reject,
    evidencePath = `/api/v2/signing-receipts/${approved.receiptId}`,
    resultPath = `${evidencePath}/file`,
    receiptHref = `/receipts/${approved.receiptId}`;
  const sourcePath = (item) =>
    `/api/v2/signing-documents/${item.documentId}/file?versionId=${item.versionId}`;
  stage = "participant_result_integrity";
  const evidence = await json(b.context.request, evidencePath);
  assert.equal(evidence.artifact.state, "ready");
  assert.equal(evidence.sourceSha256, sourceHash);
  assert.equal(evidence.artifact.pageCount, 2);
  let derived;
  for (const actor of [a, b]) {
    const dto = await json(actor.context.request, evidencePath);
    assert.equal(dto.id, approved.receiptId);
    for (const suffix of ["", "?download=1"]) {
      const response = await actor.context.request.get(resultPath + suffix);
      privateResponse(response, 200);
      assert.equal(response.headers()["x-frame-options"], "SAMEORIGIN");
      assert.equal(response.headers()["referrer-policy"], "no-referrer");
      assert.ok(response.headers()["content-type"].includes("application/pdf"));
      derived = await response.body();
      assert.equal(derived.length, evidence.artifact.bytes);
      assert.equal(hash(derived), evidence.artifact.sha256);
      if (suffix)
        assert.ok(
          response.headers()["content-disposition"].includes("attachment;"),
        );
    }
    for (const item of [approved, rejected]) {
      const source = await actor.context.request.get(sourcePath(item));
      privateResponse(source, 200);
      assert.equal(hash(await source.body()), sourceHash);
    }
  }
  assert.equal((await PDFDocument.load(derived)).getPageCount(), 2);
  const range = await b.context.request.get(resultPath, {
    headers: { Range: "bytes=0-15" },
  });
  privateResponse(range, 206);
  assert.ok((await range.body()).equals(derived.subarray(0, 16)));
  assert.equal(
    range.headers()["content-range"],
    `bytes 0-15/${derived.length}`,
  );
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, "approved-result.pdf"), derived);
  record.result = {
    bytes: derived.length,
    sha256: hash(derived),
    pageCount: 2,
  };
  await checked(
    "same_approved_pdf_hash_source_bytes_private_download_and_range_verified",
  );

  stage = "restore_exact_comparison_identity";
  // This is the already approved third identity, not a fourth account ID or a
  // replacement document. Its previous empty/deleted state was reconciled above.
  record.comparison.restoration = "requested_after_empty_proof";
  await save();
  const created = await service.auth.admin.createUser({
    id: expectedActors.C,
    email: `dvp-signing-r3-c-${expectedRun}@example.invalid`,
    password: randomBytes(30).toString("base64url") + "aA9!",
    email_confirm: true,
    user_metadata: {
      full_name: "Uji Development R3 C",
      dvp_test_suite: "signing-r3",
      dvp_test_run: expectedRun,
      dvp_test_actor: "C",
    },
  });
  assert.ok(!created.error && identity(created.data?.user, "C"));
  record.comparison.restoration = "restored_same_id";
  await save();
  const c = await session("C", created.data.user, config);
  await comparisonEmpty();
  stage = "foreign_api_and_streamed_not_found_page";
  for (const path of [
    evidencePath,
    resultPath,
    `/api/v2/signing-requests/${approved.requestId}/decision`,
    sourcePath(approved),
    sourcePath(rejected),
  ]) {
    privateResponse(await c.context.request.get(path), 404);
    privateResponse(await guest.request.get(path), 401);
  }
  const missing = await c.page.goto(receiptHref);
  assert.ok([200, 404].includes(missing.status()));
  await expect(
    c.page.getByRole("heading", { name: "Bukti tidak ditemukan", exact: true }),
  ).toBeVisible();
  await expect(
    c.page.getByRole("img", { name: "QR tautan bukti persetujuan privat" }),
  ).toHaveCount(0);
  const html = await c.page.content();
  assert.ok(
    !html.includes(evidence.documentTitle) && !html.includes(sourceHash),
  );
  assert.ok(
    (await c.page.locator('meta[name="robots"][content*="noindex"]').count()) >
      0,
  );
  record.streamedNotFoundStatus = missing.status();
  const redirected = await guest.request.get(receiptHref, { maxRedirects: 0 });
  assert.ok([307, 308].includes(redirected.status()));
  assert.equal(new URL(redirected.headers().location, base).pathname, "/login");
  const hidden = await c.client
    .from("signing_receipts")
    .select("id")
    .eq("id", approved.receiptId);
  assert.ok(!hidden.error && hidden.data?.length === 0);
  const metadata = await b.client
    .from("signing_artifacts")
    .select("storage_path")
    .eq("receipt_id", approved.receiptId)
    .single();
  assert.ok(!metadata.error && metadata.data.storage_path);
  const resultObject = metadata.data.storage_path;
  for (const actor of [b, c])
    for (const [bucket, path] of [
      ["signing-results", resultObject],
      [
        "document-submissions",
        `${expectedActors.A}/signing/${approved.documentId}/${approved.versionId}.pdf`,
      ],
    ]) {
      const direct = await actor.client.storage.from(bucket).download(path);
      assert.ok(direct.error && !direct.data);
    }
  const publicResult = await fetch(
    `${backend.origin}/storage/v1/object/public/signing-results/${resultObject}`,
    { redirect: "error", signal: AbortSignal.timeout(15000) },
  );
  assert.ok(!publicResult.ok);
  await checked(
    "same_comparison_id_foreign_api_rls_storage_and_streamed_not_found_ui_denied",
  );

  stage = "actual_pdf_qr_decoding";
  const previewContext = await browser.newContext({
    baseURL: base,
    storageState: await b.context.storageState(),
    viewport: { width: 1200, height: 1050 },
    deviceScaleFactor: 2,
  });
  for (const number of [1, 2]) {
    const page = await previewContext.newPage();
    await page.goto(`${resultPath}#page=${number}&zoom=75`);
    await expect
      .poll(
        async () => {
          const png = PNG.sync.read(await page.screenshot()),
            left = Math.floor(png.width * 0.27),
            top = number === 2 ? Math.floor(png.height / 2) : 0,
            width = png.width - left,
            height = png.height - top,
            pixels = new Uint8ClampedArray(width * height * 4);
          for (let row = 0; row < height; row++)
            pixels.set(
              png.data.subarray(
                ((row + top) * png.width + left) * 4,
                ((row + top) * png.width + png.width) * 4,
              ),
              row * width * 4,
            );
          return (
            jsQR(pixels, width, height, { inversionAttempts: "dontInvert" })
              ?.data ===
            base + receiptHref
          );
        },
        { timeout: 20000, intervals: [250, 500, 1000] },
      )
      .toBe(true);
    await page.screenshot({
      path: resolve(output, `approved-pdf-page-${number}.png`),
    });
    await page.close();
  }
  await previewContext.close();
  await checked(
    "both_cloud_pdf_qr_codes_independently_decode_to_same_private_receipt",
  );
  stage = "receipt_responsive_themes";
  await b.page.goto(receiptHref);
  await expect(
    b.page.getByRole("heading", { name: "Bukti persetujuan", exact: true }),
  ).toBeVisible();
  for (const [theme, width, height] of [
    ["light", 1440, 1000],
    ["dark", 390, 844],
  ]) {
    await b.page.setViewportSize({ width, height });
    await b.page.getByLabel("Tema", { exact: true }).selectOption(theme);
    await expect(b.page.locator("html")).toHaveAttribute("data-theme", theme);
    assert.ok(
      await b.page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    );
    await b.page.screenshot({
      path: resolve(output, `receipt-${theme}.png`),
      fullPage: true,
      mask: [b.page.locator('header [title*="@"]')],
    });
  }
  await b.page.setViewportSize({ width: 1440, height: 1000 });
  await b.page.getByLabel("Tema", { exact: true }).selectOption("light");
  await checked("same_receipt_light_desktop_dark_mobile_without_overflow");

  stage = "pending_request_rejection";
  const decisionPath = `/api/v2/signing-requests/${rejected.requestId}/decisions`,
    body = {
      action: "reject",
      sourceVersionId: rejected.versionId,
      sourceSha256: sourceHash,
      policyVersion: policy,
      confirmed: true,
      consent: false,
      reason,
    };
  for (const invalid of ["", " ", "x".repeat(1001)]) {
    const response = await b.context.request.post(decisionPath, {
      headers: {
        Origin: base,
        "Idempotency-Key": "71000000-0000-4000-8000-000000000001",
      },
      data: { ...body, reason: invalid },
    });
    privateResponse(response, 422);
  }
  await b.page.goto(`/requests/${rejected.requestId}`);
  await b.page
    .getByRole("button", { name: "Tolak dokumen", exact: true })
    .click();
  const dialog = b.page.getByRole("dialog");
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  const field = dialog.getByRole("textbox", { name: /Alasan penolakan/ });
  await expect(field).toHaveAttribute("required", "");
  await expect(field).toHaveAttribute("maxlength", "1000");
  await field.fill(reason);
  await b.page.route(`**${decisionPath}`, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const value = request.postDataJSON(),
      key = request.headers()["idempotency-key"];
    assert.ok(uuid.test(key ?? ""));
    assert.deepEqual(value, body);
    record.rejectionIdempotencyKey = key;
    await save();
    await route.continue();
  });
  const deciding = b.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === decisionPath &&
      response.request().method() === "POST",
    { timeout: 30000 },
  );
  await dialog
    .getByRole("button", { name: "Ya, tolak dokumen", exact: true })
    .click();
  const rejectedResponse = await deciding;
  privateResponse(rejectedResponse, 201);
  const rejection = (await rejectedResponse.json()).data;
  assert.ok(uuid.test(rejection.decisionId));
  record.receipts.reject = {
    ...rejected,
    decisionId: rejection.decisionId,
    status: "rejected",
  };
  await save();
  assert.equal(rejection.receiptId, null);
  assert.equal(rejection.reason, reason);
  const replay = await b.context.request.post(decisionPath, {
    headers: {
      Origin: base,
      "Idempotency-Key": record.rejectionIdempotencyKey,
    },
    data: body,
  });
  privateResponse(replay, 201);
  assert.equal((await replay.json()).data.decisionId, rejection.decisionId);
  await expect(
    b.page.getByRole("heading", { name: "Dokumen ditolak", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    b.page.getByRole("link", { name: "Pratinjau PDF", exact: true }),
  ).toHaveCount(0);
  await expect(b.page.getByText(reason, { exact: true })).toBeVisible();
  for (const actor of [a, b]) {
    const outcome = await json(
      actor.context.request,
      `/api/v2/signing-requests/${rejected.requestId}/decision`,
    );
    assert.equal(outcome.decision.reason, reason);
    assert.equal(outcome.evidence, null);
  }
  privateResponse(await b.context.request.get(sourcePath(rejected)), 404);
  privateResponse(
    await b.context.request.get(
      `/api/v2/signing-documents/${rejected.documentId}`,
    ),
    404,
  );
  const ended = await json(
    b.context.request,
    `/api/v2/signing-requests/${rejected.requestId}`,
  );
  assert.equal(ended.request.status, "rejected");
  assert.equal(ended.request.canReadFile, false);
  assert.equal(ended.request.documentTitle, null);
  assert.equal(ended.document, null);
  const revoked = await b.client
      .from("signing_document_versions")
      .select("id")
      .eq("id", rejected.versionId),
    noReceipt = await b.client
      .from("signing_receipts")
      .select("id")
      .eq("request_id", rejected.requestId);
  assert.ok(
    !revoked.error &&
      revoked.data?.length === 0 &&
      !noReceipt.error &&
      noReceipt.data?.length === 0,
  );
  privateResponse(
    await c.context.request.get(
      `/api/v2/signing-requests/${rejected.requestId}/decision`,
    ),
    404,
  );
  const ownerSource = await a.context.request.get(sourcePath(rejected));
  privateResponse(ownerSource, 200);
  assert.equal(hash(await ownerSource.body()), sourceHash);
  await checked(
    "same_pending_request_rejected_once_required_reason_no_qr_and_source_revoked",
  );

  stage = "final_cloud_reconciliation";
  const docs = await service
      .from("signing_documents")
      .select("id")
      .eq("owner_id", expectedActors.A)
      .limit(3),
    versions = await service
      .from("signing_document_versions")
      .select("id,storage_path,source_sha256,file_size_bytes")
      .eq("owner_id", expectedActors.A)
      .limit(3),
    requests = await service
      .from("signing_requests")
      .select("id,status")
      .eq("owner_id", expectedActors.A)
      .eq("recipient_id", expectedActors.B)
      .limit(3),
    decisions = await service
      .from("signing_decisions")
      .select("id,request_id,action,reason,actor_id")
      .eq("actor_id", expectedActors.B)
      .limit(3),
    receipts = await service
      .from("signing_receipts")
      .select("id,request_id")
      .eq("owner_id", expectedActors.A)
      .limit(2);
  for (const reply of [docs, versions, requests, decisions, receipts])
    assert.ok(!reply.error && Array.isArray(reply.data));
  assert.equal(docs.data.length, 2);
  assert.equal(versions.data.length, 2);
  assert.equal(requests.data.length, 2);
  assert.equal(decisions.data.length, 2);
  assert.equal(receipts.data.length, 1);
  assert.equal(receipts.data[0].id, approved.receiptId);
  assert.equal(receipts.data[0].request_id, approved.requestId);
  for (const action of ["approve", "reject"]) {
    const request = requests.data.find(
        (item) => item.id === expectedRequests[action],
      ),
      decision = decisions.data.find((item) => item.request_id === request.id);
    assert.equal(
      request.status,
      action === "approve" ? "completed" : "rejected",
    );
    assert.equal(decision.action, action);
    assert.equal(decision.actor_id, expectedActors.B);
    assert.equal(decision.reason, action === "approve" ? null : reason);
  }
  for (const item of versions.data) {
    assert.equal(item.file_size_bytes, 2831);
    assert.equal(item.source_sha256, sourceHash);
    const bytes = await service.storage
      .from("document-submissions")
      .download(item.storage_path);
    assert.ok(!bytes.error && bytes.data?.size === 2831);
    assert.equal(
      hash(new Uint8Array(await bytes.data.arrayBuffer())),
      sourceHash,
    );
    const prefix = item.storage_path.slice(
        0,
        item.storage_path.lastIndexOf("/"),
      ),
      objects = await service.storage
        .from("document-submissions")
        .list(prefix, { limit: 2 });
    assert.ok(!objects.error && objects.data?.length === 1);
  }
  const artifact = await service
    .from("signing_artifacts")
    .select("state,artifact_sha256,file_size_bytes,page_count,storage_path")
    .eq("receipt_id", approved.receiptId)
    .single();
  assert.ok(!artifact.error && artifact.data.state === "ready");
  assert.equal(artifact.data.artifact_sha256, record.result.sha256);
  assert.equal(artifact.data.file_size_bytes, 17527);
  assert.equal(artifact.data.page_count, 2);
  const files = await service.storage
    .from("signing-results")
    .list(`${expectedActors.A}/signing-results/${approved.receiptId}`, {
      limit: 2,
    });
  assert.ok(!files.error && files.data?.length === 1);
  await comparisonEmpty();
  const checkC = await service.auth.admin.getUserById(expectedActors.C);
  assert.ok(!checkC.error && identity(checkC.data?.user, "C"));
  await c.client.auth.signOut({ scope: "local" });
  await c.context.close();
  const deleted = await service.auth.admin.deleteUser(expectedActors.C);
  assert.ok(!deleted.error);
  const absent = await service.auth.admin.getUserById(expectedActors.C);
  assert.ok(!absent.data?.user && absent.error?.status === 404);
  record.comparison.restoration = "restored_same_id_then_cleaned_up";
  assert.equal(hash(await readFile(originalPath)), record.originalProofSha256);
  await checked(
    "exact_two_sources_two_decisions_one_result_no_duplicate_history_and_comparison_cleanup",
  );
  record.status = "passed";
  stage = "complete";
  await save();
  const final = {
    ...proof,
    status: "passed_after_reviewed_resume",
    initialAttempt: {
      status: proof.status,
      lastFailure: proof.lastFailure,
      proofPath: originalPath,
      proofSha256: record.originalProofSha256,
    },
    resume: record,
    receipts: { ...proof.receipts, reject: record.receipts.reject },
    result: record.result,
  };
  delete final.lastFailure;
  final.accounts.B.observed.decisions = 2;
  final.accounts.C.disposition = "cleaned_up";
  await writeFile(
    `${primaryPath}.resume.tmp`,
    JSON.stringify(final, null, 2) + "\n",
    { mode: 0o600 },
  );
  await rename(`${primaryPath}.resume.tmp`, primaryPath);
  console.log(
    JSON.stringify({
      runId: expectedRun,
      status: "passed_after_reviewed_resume",
      originalCheckGroups: proof.checks.length,
      resumeCheckGroups: record.checks.length,
      sourceDocuments: 2,
      decisions: 2,
      receipts: 1,
      sourceObjects: 2,
      resultObjects: 1,
      resultPages: 2,
      restoredComparisonId: expectedActors.C,
      comparisonCleaned: true,
    }),
  );
}
try {
  await main();
} catch {
  if (started) {
    record.status = "failed_requires_review";
    await save().catch(() => {});
  }
  console.error(
    `R3 existing-fixture continuation stopped during ${stage}; original history and proof retained.`,
  );
  process.exitCode = 1;
} finally {
  for (const client of sessions)
    await client.auth.signOut({ scope: "local" }).catch(() => {});
  await browser?.close();
  if (locked) {
    try {
      if ((await readFile(lockPath, "utf8")) === expectedRun)
        await unlink(lockPath);
    } catch {
      process.exitCode = 1;
      console.error("R3 continuation lock needs review.");
    }
  }
}
