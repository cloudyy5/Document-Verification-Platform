import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// This runner intentionally leaves immutable development history. It must not
// run merely because normal unit/browser tests were requested.
const workspace = process.cwd();
const runId = randomUUID();
const resultsDirectory = resolve(workspace, "test-results");
const receiptPath = resolve(resultsDirectory, `cloud-signing-r3-${runId}.json`);
const lastReceiptPath = resolve(resultsDirectory, "cloud-signing-r3-run.json");
const lockPath = resolve(resultsDirectory, "cloud-signing-r3.lock");
const fixtureSha256 =
  "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const kinds = ["A", "B", "C"];
const accounts = {};
const record = {
  schemaVersion: 3,
  runId,
  status: "preparing",
  fixtureSha256,
  fixtureBytes: 2831,
  accounts: {},
  receipts: {},
};
let service;
let child;
let locked = false;
let recordStarted = false;
let launched = false;
let failed = false;
let interrupted = false;

function fail(message) {
  failed = true;
  console.error(message);
}
function assertRunning() {
  if (interrupted) throw new Error("Signing acceptance was interrupted.");
}
function matchesIdentity(user, kind) {
  const account = accounts[kind];
  return (
    user?.id === account?.id &&
    user?.email === account?.email &&
    user?.user_metadata?.dvp_test_suite === "signing-r3" &&
    user?.user_metadata?.dvp_test_run === runId &&
    user?.user_metadata?.dvp_test_actor === kind
  );
}
async function atomicJson(filename, value) {
  const temporary = `${filename}.${runId}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporary, filename);
}
async function saveRecord() {
  await atomicJson(receiptPath, record);
  await atomicJson(lastReceiptPath, record);
  recordStarted = true;
}
function safePriorRecord(prior) {
  return (
    prior?.schemaVersion === 3 &&
    prior.status === "failed_confirmed_empty" &&
    prior.reconciledEmpty === true &&
    !prior.receipt &&
    Object.keys(prior.receipts ?? {}).length === 0 &&
    kinds.every((kind) => {
      const account = prior.accounts?.[kind];
      return (
        account &&
        ["not_created", "cleaned_up"].includes(account.disposition) &&
        (account.disposition === "not_created" || uuid.test(account.id))
      );
    })
  );
}
async function guardPriorRun() {
  // A second process must not pass the same empty-state check concurrently.
  await mkdir(resultsDirectory, { recursive: true });
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
    await lock.writeFile(JSON.stringify({ runId }));
    locked = true;
  } catch {
    throw new Error("Existing signing run lock requires operator review.");
  } finally {
    await lock?.close();
  }
  let prior;
  try {
    prior = JSON.parse(await readFile(lastReceiptPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT")
      throw new Error(
        "Existing signing fixture proof requires operator review.",
        { cause: error },
      );
  }
  if (prior !== undefined && !safePriorRecord(prior))
    throw new Error("Existing signing fixture proof requires operator review.");
  // A missing last-run pointer must not hide an earlier partial/successful run.
  for (const filename of await readdir(resultsDirectory)) {
    if (!/^cloud-signing-r3-[0-9a-f-]{36}\.json$/i.test(filename)) continue;
    const previous = JSON.parse(
      await readFile(resolve(resultsDirectory, filename), "utf8"),
    );
    if (!safePriorRecord(previous))
      throw new Error(
        "Existing signing fixture proof requires operator review.",
      );
  }
}

async function readiness() {
  const tables = {
    signing_user_identifiers: "user_id,code,created_at",
    signing_documents: "id,owner_id",
    signing_document_versions:
      "id,document_id,owner_id,source_sha256,file_size_bytes,storage_path",
    signing_requests:
      "id,document_id,source_version_id,owner_id,recipient_id,status,cancelled_at",
    signing_decisions:
      "id,request_id,source_version_id,actor_id,action,reason,authentication_method",
    signing_receipts:
      "id,request_id,decision_id,owner_id,recipient_id,source_sha256,layout_version",
    signing_artifacts:
      "receipt_id,state,storage_path,artifact_sha256,file_size_bytes,page_count",
  };
  for (const [table, columns] of Object.entries(tables)) {
    const result = await service
      .from(table)
      .select(columns, { head: true })
      .limit(0);
    if (result.error)
      throw new Error("Signing schema is not ready; no account was created.");
  }
  const probe = await service.rpc("decide_signing_request", {
    p_actor_id: null,
    p_request_id: null,
    p_decision_id: null,
    p_source_version_id: null,
    p_source_sha256: null,
    p_action: null,
    p_reason: null,
    p_policy_version: null,
    p_consent: null,
    p_confirmed: null,
    p_confirmation_digest: null,
  });
  const quota = await service.rpc("consume_signing_r3_limit", {
    p_action: "invalid",
    p_key_digest: "invalid",
    p_global_digest: "invalid",
  });
  const bucket = await service.storage.getBucket("document-submissions");
  const results = await service.storage.getBucket("signing-results");
  if (
    probe.error?.code !== "42501" ||
    probe.error?.message !== "SIGNING_ACTOR_REQUIRED" ||
    quota.error?.code !== "22023" ||
    bucket.error ||
    bucket.data?.public !== false ||
    results.error ||
    results.data?.public !== false ||
    Number(results.data?.file_size_limit) !== 20971520 ||
    results.data.allowed_mime_types?.length !== 1 ||
    results.data.allowed_mime_types[0] !== "application/pdf"
  )
    throw new Error(
      "Signing schema/private storage is not ready; no account was created.",
    );
}
async function createAccount(kind) {
  assertRunning();
  // Save the exact planned Auth ID BEFORE requesting its creation. A lost
  // response can never be mistaken for an account that was never requested.
  const account = accounts[kind];
  record.accounts[kind].disposition = "creation_requested";
  await saveRecord();
  const result = await service.auth.admin.createUser({
    id: account.id,
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: {
      full_name: `Uji Development R3 ${kind}`,
      dvp_test_suite: "signing-r3",
      dvp_test_run: runId,
      dvp_test_actor: kind,
    },
  });
  if (result.error || !matchesIdentity(result.data?.user, kind)) {
    record.accounts[kind].disposition = "creation_uncertain_requires_operator";
    await saveRecord();
    throw new Error(
      "Synthetic signing account creation requires operator review.",
    );
  }
  record.accounts[kind].disposition = "created";
  await saveRecord();
}
async function accountState(kind) {
  const id = accounts[kind].id;
  const [
    identity,
    legacyDocuments,
    legacyVersions,
    documents,
    versions,
    requests,
    objects,
    decisions,
    receipts,
    resultObjects,
  ] = await Promise.all([
    service.auth.admin.getUserById(id),
    service.from("documents").select("id").eq("owner_id", id).limit(1),
    service
      .from("document_submissions")
      .select("id")
      .eq("submitted_by", id)
      .limit(1),
    service.from("signing_documents").select("id").eq("owner_id", id).limit(2),
    service
      .from("signing_document_versions")
      .select("id,document_id")
      .eq("owner_id", id)
      .limit(2),
    service
      .from("signing_requests")
      .select("id,status")
      .or(`owner_id.eq.${id},recipient_id.eq.${id}`)
      .limit(2),
    service.storage.from("document-submissions").list(id, { limit: 2 }),
    service.from("signing_decisions").select("id").eq("actor_id", id).limit(3),
    service
      .from("signing_receipts")
      .select("id")
      .or(`owner_id.eq.${id},recipient_id.eq.${id}`)
      .limit(3),
    service.storage.from("signing-results").list(id, { limit: 3 }),
  ]);
  const data = {
    legacyDocuments,
    legacyVersions,
    documents,
    versions,
    requests,
    objects,
    decisions,
    receipts,
    resultObjects,
  };
  if (
    identity.error ||
    !matchesIdentity(identity.data?.user, kind) ||
    Object.values(data).some(
      (result) => result.error || !Array.isArray(result.data),
    )
  )
    throw new Error(
      "Synthetic signing account reconciliation requires operator review.",
    );
  return Object.fromEntries(
    Object.entries(data).map(([name, result]) => [name, result.data]),
  );
}
async function cleanOrRetain(kind) {
  const entry = record.accounts[kind];
  if (!service || !entry || entry.disposition === "not_created") return;
  if (
    entry.disposition === "creation_requested" ||
    entry.disposition === "creation_uncertain_requires_operator"
  ) {
    // A create request may still have committed after a network timeout.
    fail("An uncertain Auth creation is retained for operator reconciliation.");
    return;
  }
  try {
    const state = await accountState(kind);
    entry.observed = Object.fromEntries(
      Object.entries(state).map(([name, rows]) => [name, rows.length]),
    );
    const empty = Object.values(state).every((rows) => rows.length === 0);
    // A/B may acquire immutable history even when the browser receipt was lost.
    // Keep them after browser launch; only C is eligible for automatic cleanup.
    if (!empty || (launched && kind !== "C")) {
      entry.disposition = "retained_for_history_or_reconciliation";
      if (kind === "C")
        fail("Outsider account has unexpected data and was retained.");
      return;
    }
    entry.disposition = "deletion_requested_after_empty_proof";
    await saveRecord();
    const deleted = await service.auth.admin.deleteUser(accounts[kind].id);
    if (deleted.error) {
      entry.disposition = "cleanup_requires_operator";
      fail("Synthetic signing account cleanup requires operator review.");
    } else {
      entry.disposition = "cleaned_up";
    }
  } catch {
    entry.disposition = "reconciliation_requires_operator";
    fail(
      "Synthetic signing account was retained because reconciliation was unavailable.",
    );
  }
}
function readProof(proof) {
  if (proof?.schemaVersion !== 3 || proof?.runId !== runId)
    throw new Error("Signing proof run marker does not match.");
  if (Array.isArray(proof.checks))
    record.checks = proof.checks.filter(
      (value) => typeof value === "string" && /^[a-z0-9_-]{1,80}$/i.test(value),
    );
  for (const action of ["approve", "reject"]) {
    const value = proof.receipts?.[action];
    if (
      !value ||
      !uuid.test(value.documentId ?? "") ||
      !uuid.test(value.versionId ?? "")
    )
      continue;
    const item = { documentId: value.documentId, versionId: value.versionId };
    for (const field of ["requestId", "decisionId"])
      if (uuid.test(value[field] ?? "")) item[field] = value[field];
    if (
      ["draft", "pending", "consented", "completed", "rejected"].includes(
        value.status,
      )
    )
      item.status = value.status;
    if (
      action === "approve" &&
      /^[A-Za-z0-9_-]{43}$/.test(value.receiptId ?? "")
    )
      item.receiptId = value.receiptId;
    record.receipts[action] = item;
  }
  const stage =
    proof.lastFailure?.stage ??
    (proof.status === "failed" ? proof.stage : null);
  if (/^[a-z0-9_-]{1,80}$/i.test(stage ?? "")) record.lastFailure = { stage };
  return proof.status;
}
async function confirmReceipt() {
  const approved = record.receipts.approve,
    rejected = record.receipts.reject;
  if (
    !approved?.receiptId ||
    !approved.decisionId ||
    !rejected?.decisionId ||
    !approved.requestId ||
    !rejected.requestId
  )
    throw new Error(
      "Signing cloud proof is incomplete; retain fixtures for review.",
    );
  const items = [approved, rejected],
    ids = items.map((item) => item.requestId);
  const [documents, versions, requests, decisions, receipts] =
    await Promise.all([
      service
        .from("signing_documents")
        .select("id,owner_id")
        .eq("owner_id", accounts.A.id)
        .limit(3),
      service
        .from("signing_document_versions")
        .select(
          "id,document_id,owner_id,source_sha256,file_size_bytes,storage_path",
        )
        .eq("owner_id", accounts.A.id)
        .limit(3),
      service
        .from("signing_requests")
        .select("id,document_id,source_version_id,owner_id,recipient_id,status")
        .eq("owner_id", accounts.A.id)
        .limit(3),
      service
        .from("signing_decisions")
        .select(
          "id,request_id,source_version_id,actor_id,action,reason,consent,authentication_method",
        )
        .in("request_id", ids)
        .limit(3),
      service
        .from("signing_receipts")
        .select(
          "id,decision_id,request_id,source_version_id,owner_id,recipient_id,source_sha256,layout_version",
        )
        .eq("owner_id", accounts.A.id)
        .limit(2),
    ]);
  if (
    [documents, versions, requests, decisions, receipts].some(
      (result) => result.error || !Array.isArray(result.data),
    ) ||
    documents.data.length !== 2 ||
    versions.data.length !== 2 ||
    requests.data.length !== 2 ||
    decisions.data.length !== 2 ||
    receipts.data.length !== 1
  )
    throw new Error(
      "Signing cloud receipt reconciliation failed; retain fixtures for review.",
    );
  for (const [index, item] of items.entries()) {
    const action = index === 0 ? "approve" : "reject",
      expected = index === 0 ? "completed" : "rejected";
    const document = documents.data.find((row) => row.id === item.documentId);
    const version = versions.data.find((row) => row.id === item.versionId);
    const request = requests.data.find((row) => row.id === item.requestId);
    const decision = decisions.data.find(
      (row) => row.request_id === item.requestId,
    );
    const prefix = `${accounts.A.id}/signing/${item.documentId}`;
    if (
      !document ||
      !version ||
      !request ||
      !decision ||
      version.document_id !== item.documentId ||
      version.owner_id !== accounts.A.id ||
      version.storage_path !== `${prefix}/${item.versionId}.pdf` ||
      version.source_sha256 !== fixtureSha256 ||
      version.file_size_bytes !== 2831 ||
      request.document_id !== item.documentId ||
      request.source_version_id !== item.versionId ||
      request.recipient_id !== accounts.B.id ||
      request.status !== expected ||
      decision.id !== item.decisionId ||
      decision.actor_id !== accounts.B.id ||
      decision.source_version_id !== item.versionId ||
      decision.action !== action ||
      decision.consent !== (action === "approve") ||
      decision.authentication_method !== "session_explicit_confirmation-v1" ||
      (action === "approve"
        ? decision.reason !== null
        : decision.reason !== "Tidak sesuai kebutuhan uji development R3.")
    )
      throw new Error(
        "Signing cloud receipt reconciliation failed; retain fixtures for review.",
      );
    const objects = await service.storage
      .from("document-submissions")
      .list(prefix, { limit: 2 });
    const source = await service.storage
      .from("document-submissions")
      .download(version.storage_path);
    if (
      objects.error ||
      objects.data?.length !== 1 ||
      objects.data[0]?.name !== `${item.versionId}.pdf` ||
      source.error ||
      source.data?.size !== 2831 ||
      createHash("sha256")
        .update(new Uint8Array(await source.data.arrayBuffer()))
        .digest("hex") !== fixtureSha256
    )
      throw new Error(
        "Signing cloud receipt reconciliation failed; retain fixtures for review.",
      );
    item.status = expected;
  }
  const receipt = receipts.data[0];
  if (
    receipt.id !== approved.receiptId ||
    receipt.decision_id !== approved.decisionId ||
    receipt.request_id !== approved.requestId ||
    receipt.source_version_id !== approved.versionId ||
    receipt.recipient_id !== accounts.B.id ||
    receipt.source_sha256 !== fixtureSha256 ||
    receipt.layout_version !== "all-pages-bottom-left-and-evidence-v1"
  )
    throw new Error(
      "Signing cloud receipt reconciliation failed; retain fixtures for review.",
    );
  const artifact = await service
    .from("signing_artifacts")
    .select(
      "receipt_id,state,storage_path,artifact_sha256,file_size_bytes,page_count",
    )
    .eq("receipt_id", receipt.id)
    .maybeSingle();
  const row = artifact.data,
    prefix = `${accounts.A.id}/signing-results/${receipt.id}/`;
  if (
    artifact.error ||
    !row ||
    row.state !== "ready" ||
    !row.storage_path?.startsWith(prefix) ||
    !row.storage_path.endsWith(".pdf") ||
    !uuid.test(row.storage_path.slice(prefix.length, -4)) ||
    row.page_count !== 2 ||
    !/^[a-f0-9]{64}$/.test(row.artifact_sha256 ?? "") ||
    row.file_size_bytes < 1 ||
    row.file_size_bytes > 20971520
  )
    throw new Error(
      "Signing cloud receipt reconciliation failed; retain fixtures for review.",
    );
  const [objects, result] = await Promise.all([
    service.storage
      .from("signing-results")
      .list(prefix.slice(0, -1), { limit: 2 }),
    service.storage.from("signing-results").download(row.storage_path),
  ]);
  if (
    objects.error ||
    objects.data?.length !== 1 ||
    objects.data[0]?.name !== row.storage_path.slice(prefix.length) ||
    result.error ||
    result.data?.size !== row.file_size_bytes ||
    createHash("sha256")
      .update(new Uint8Array(await result.data.arrayBuffer()))
      .digest("hex") !== row.artifact_sha256
  )
    throw new Error(
      "Signing cloud receipt reconciliation failed; retain fixtures for review.",
    );
  record.sourceObjects = "two_verified_private_sources";
  record.result = {
    state: "ready",
    pageCount: row.page_count,
    bytes: row.file_size_bytes,
    sha256: row.artifact_sha256,
  };
}

function redact(text) {
  const values = [
    ...Object.values(accounts).flatMap((account) => [
      account.email,
      account.password,
    ]),
    ...Object.entries(process.env)
      .filter(([name]) => /secret|password|token|key|database_url/i.test(name))
      .map(([, value]) => value),
  ].filter((value) => typeof value === "string" && value.length > 3);
  let output = String(text);
  for (const value of values)
    for (const variant of new Set([value, encodeURIComponent(value)]))
      output = output.split(variant).join("[redacted]");
  return output
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "[redacted]",
    );
}
async function launchBrowser() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /secret|password|token|cookie|database_url|direct_url|service_role/i.test(
        key,
      ) ||
      (/key/i.test(key) && key !== "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
      key.startsWith("DVP_")
    )
      delete env[key];
  }
  Object.assign(env, {
    DVP_SIGNING_R3_CLOUD_TEST: "1",
    DVP_SIGNING_R3_CLOUD_RUN_ID: runId,
    DVP_SIGNING_R3_CLOUD_PROOF: receiptPath,
  });
  for (const kind of kinds) {
    for (const field of ["id", "email", "password"])
      env[`DVP_SIGNING_R3_CLOUD_${kind}_${field.toUpperCase()}`] =
        accounts[kind][field];
  }
  return new Promise((resolveExit) => {
    child = spawn(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "playwright.signing-r3-cloud.config.ts",
      ],
      {
        cwd: workspace,
        env,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    // Flush complete lines only: a credential split across stdout chunks still
    // receives redaction before becoming visible in the transcript.
    for (const stream of [child.stdout, child.stderr]) {
      let pending = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        pending += chunk;
        let newline;
        while ((newline = pending.indexOf("\n")) !== -1) {
          console.log(redact(pending.slice(0, newline)));
          pending = pending.slice(newline + 1);
        }
        if (pending.length > 1_048_576)
          pending = "[oversized child log omitted]";
      });
      stream.on("end", () => {
        if (pending) console.log(redact(pending));
      });
    }
    child.once("error", () => resolveExit(1));
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    interrupted = true;
    failed = true;
    child?.kill("SIGTERM");
  });

async function main() {
  const checkOnly = process.argv.includes("--check-only");
  if (!checkOnly && !process.argv.includes("--confirm-persistent-fixture"))
    throw new Error(
      "Explicit persistent-development-fixture confirmation is required.",
    );
  const app = new URL(process.env.APP_URL ?? "");
  const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (
    !["http:", "https:"].includes(app.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) ||
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== "/" ||
    (process.env.DOCUMENT_ENVIRONMENT ?? "development") !== "development" ||
    backend.protocol !== "https:" ||
    !backend.hostname.endsWith(".supabase.co") ||
    backend.username ||
    backend.password ||
    backend.search ||
    backend.hash ||
    backend.pathname !== "/" ||
    !publicKey ||
    !secretKey
  )
    throw new Error(
      "Only a configured loopback development app and Supabase cloud are permitted.",
    );
  await guardPriorRun();
  const fixture = await readFile(
    resolve(workspace, "tests/fixtures/phase-3-development.pdf"),
  );
  if (
    fixture.length !== 2831 ||
    createHash("sha256").update(fixture).digest("hex") !== fixtureSha256
  )
    throw new Error("The reviewed synthetic signing fixture does not match.");
  if (checkOnly) {
    console.log(
      "R3 runner offline check passed: fixture, development configuration and prior-run guard; zero network requests or accounts.",
    );
    return;
  }
  const sdk = {
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
          signal: AbortSignal.timeout(15_000),
        }),
    },
  };
  service = createClient(backend.origin, secretKey, sdk);
  await readiness();
  for (const kind of kinds) {
    accounts[kind] = {
      id: randomUUID(),
      email: `dvp-signing-r3-${kind.toLowerCase()}-${runId}@example.invalid`,
      password: `${randomBytes(30).toString("base64url")}aA9!`,
    };
    record.accounts[kind] = {
      id: accounts[kind].id,
      disposition: "not_created",
    };
  }
  await saveRecord();
  for (const kind of kinds) {
    await createAccount(kind);
    assertRunning();
    const user = createClient(backend.origin, publicKey, sdk);
    const signed = await user.auth.signInWithPassword({
      email: accounts[kind].email,
      password: accounts[kind].password,
    });
    if (signed.error || signed.data.user?.id !== accounts[kind].id)
      throw new Error("Synthetic signing account sign-in failed.");
    const roles = await user
      .from("user_roles")
      .select("role")
      .eq("user_id", accounts[kind].id);
    const identifier = await user
      .from("signing_user_identifiers")
      .select("user_id,code")
      .eq("user_id", accounts[kind].id)
      .maybeSingle();
    const state = await accountState(kind);
    if (
      roles.error ||
      roles.data?.length !== 1 ||
      roles.data[0]?.role !== "user" ||
      identifier.error ||
      identifier.data?.user_id !== accounts[kind].id ||
      !/^DVP-[A-F0-9]{20}$/.test(identifier.data?.code ?? "") ||
      Object.values(state).some((rows) => rows.length !== 0)
    )
      throw new Error("Synthetic signing account baseline is not ready.");
    await user.auth.signOut({ scope: "local" });
  }
  assertRunning();
  record.status = "browser_starting";
  record.accounts.A.disposition = "retained_for_history_or_reconciliation";
  record.accounts.B.disposition = "retained_for_history_or_reconciliation";
  await saveRecord();
  launched = true;
  const exitCode = await launchBrowser();
  const status = readProof(JSON.parse(await readFile(receiptPath, "utf8")));
  if (exitCode !== 0 || status !== "passed")
    throw new Error(
      "Signing browser acceptance did not complete; retain fixtures for review.",
    );
  await confirmReceipt();
}
try {
  await main();
} catch (error) {
  const allowed = new Set([
    "Explicit persistent-development-fixture confirmation is required.",
    "Only a configured loopback development app and Supabase cloud are permitted.",
    "Existing signing run lock requires operator review.",
    "Existing signing fixture proof requires operator review.",
    "The reviewed synthetic signing fixture does not match.",
    "Signing schema is not ready; no account was created.",
    "Signing schema/private storage is not ready; no account was created.",
    "Synthetic signing account creation requires operator review.",
    "Synthetic signing account reconciliation requires operator review.",
    "Synthetic signing account sign-in failed.",
    "Synthetic signing account baseline is not ready.",
    "Signing proof run marker does not match.",
    "Signing cloud proof is incomplete; retain fixtures for review.",
    "Signing cloud receipt reconciliation failed; retain fixtures for review.",
    "Signing browser acceptance did not complete; retain fixtures for review.",
    "Signing acceptance was interrupted.",
  ]);
  fail(
    allowed.has(error?.message)
      ? error.message
      : "Signing acceptance could not complete; no provider details are logged.",
  );
} finally {
  if (recordStarted) {
    for (const kind of ["C", "B", "A"]) await cleanOrRetain(kind);
    record.reconciledEmpty =
      Object.keys(record.receipts).length === 0 &&
      kinds.every((kind) =>
        ["not_created", "cleaned_up"].includes(
          record.accounts[kind]?.disposition,
        ),
      );
    record.status = failed
      ? record.reconciledEmpty
        ? "failed_confirmed_empty"
        : "failed_requires_review"
      : "passed_with_persistent_fixture";
    try {
      await saveRecord();
    } catch {
      fail("The safe signing operator record could not be saved.");
    }
    console.log(`Signing development acceptance run: ${runId}`);
    console.log("Safe operator record: test-results/cloud-signing-r3-run.json");
    if (launched)
      console.log(
        "Synthetic A/B and any committed signing history are retained intentionally.",
      );
  }
  if (locked) {
    try {
      const lock = JSON.parse(await readFile(lockPath, "utf8"));
      if (lock.runId === runId) await unlink(lockPath);
    } catch {
      fail(
        "Signing run lock could not be released; operator review is required.",
      );
    }
  }
}
process.exitCode = failed ? 1 : 0;
