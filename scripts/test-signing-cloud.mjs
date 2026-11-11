import { createHash, randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  mkdir,
  open,
  readFile,
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
const receiptPath = resolve(resultsDirectory, `cloud-signing-${runId}.json`);
const lastReceiptPath = resolve(resultsDirectory, "cloud-signing-run.json");
const lockPath = resolve(resultsDirectory, "cloud-signing.lock");
const fixtureSha256 =
  "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const kinds = ["A", "B", "C"];
const accounts = {};
const record = {
  schemaVersion: 1,
  runId,
  status: "preparing",
  fixtureSha256,
  fixtureBytes: 2831,
  accounts: {},
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
    user?.user_metadata?.dvp_test_suite === "signing-r2" &&
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
    prior?.schemaVersion === 1 &&
    prior.status === "failed_confirmed_empty" &&
    prior.reconciledEmpty === true &&
    !prior.receipt &&
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
}

async function readiness() {
  const tables = {
    signing_user_identifiers: "user_id,code,created_at",
    signing_documents: "id,owner_id",
    signing_document_versions:
      "id,document_id,owner_id,source_sha256,file_size_bytes,storage_path",
    signing_requests:
      "id,document_id,source_version_id,owner_id,recipient_id,status,cancelled_at",
  };
  for (const [table, columns] of Object.entries(tables)) {
    const result = await service
      .from(table)
      .select(columns, { head: true })
      .limit(0);
    if (result.error)
      throw new Error("Signing schema is not ready; no account was created.");
  }
  const probe = await service.rpc("lookup_signing_recipient", {
    p_actor_id: null,
    p_code: null,
  });
  const quota = await service.rpc("consume_signing_operation_limit", {
    p_action: "invalid",
    p_key_digest: "invalid",
    p_global_digest: "invalid",
  });
  const bucket = await service.storage.getBucket("document-submissions");
  if (
    probe.error?.code !== "42501" ||
    probe.error?.message !== "SIGNING_ACTOR_REQUIRED" ||
    quota.error?.code !== "22023" ||
    bucket.error ||
    bucket.data?.public !== false
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
      full_name: `Uji Development R2 ${kind}`,
      dvp_test_suite: "signing-r2",
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
  ]);
  const data = {
    legacyDocuments,
    legacyVersions,
    documents,
    versions,
    requests,
    objects,
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
  if (proof?.runId !== runId)
    throw new Error("Signing proof run marker does not match.");
  if (Array.isArray(proof.checks))
    record.checks = proof.checks.filter(
      (value) => typeof value === "string" && /^[a-z0-9_-]{1,80}$/i.test(value),
    );
  if (proof.receipt && typeof proof.receipt === "object") {
    const receipt = {};
    for (const key of ["documentId", "versionId", "requestId"])
      if (uuid.test(proof.receipt[key] ?? ""))
        receipt[key] = proof.receipt[key];
    if (["draft", "pending", "cancelled"].includes(proof.receipt.status))
      receipt.status = proof.receipt.status;
    if (receipt.documentId && receipt.versionId) record.receipt = receipt;
  }
  if (/^[a-z0-9_-]{1,80}$/i.test(proof.lastFailure?.stage ?? ""))
    record.lastFailure = { stage: proof.lastFailure.stage };
  else if (
    proof.status === "failed" &&
    /^[a-z0-9_-]{1,80}$/i.test(proof.stage ?? "")
  )
    record.lastFailure = { stage: proof.stage };
  return proof.status;
}
async function confirmReceipt() {
  const receipt = record.receipt;
  if (!receipt?.documentId || !receipt.versionId || !receipt.requestId)
    throw new Error(
      "Signing cloud proof is incomplete; retain fixtures for review.",
    );
  const [document, version, request, objects] = await Promise.all([
    service
      .from("signing_documents")
      .select("id,owner_id")
      .eq("id", receipt.documentId)
      .eq("owner_id", accounts.A.id)
      .maybeSingle(),
    service
      .from("signing_document_versions")
      .select(
        "id,document_id,owner_id,source_sha256,file_size_bytes,storage_path",
      )
      .eq("id", receipt.versionId)
      .eq("document_id", receipt.documentId)
      .eq("owner_id", accounts.A.id)
      .maybeSingle(),
    service
      .from("signing_requests")
      .select(
        "id,document_id,source_version_id,owner_id,recipient_id,status,cancelled_at",
      )
      .eq("id", receipt.requestId)
      .eq("owner_id", accounts.A.id)
      .eq("recipient_id", accounts.B.id)
      .maybeSingle(),
    service.storage
      .from("document-submissions")
      .list(`${accounts.A.id}/signing/${receipt.documentId}`, { limit: 2 }),
  ]);
  if (
    document.error ||
    !document.data ||
    version.error ||
    !version.data ||
    request.error ||
    !request.data ||
    objects.error ||
    !Array.isArray(objects.data) ||
    objects.data.length !== 1 ||
    objects.data[0]?.name !== `${receipt.versionId}.pdf` ||
    version.data.source_sha256 !== fixtureSha256 ||
    version.data.file_size_bytes !== 2831 ||
    version.data.storage_path !==
      `${accounts.A.id}/signing/${receipt.documentId}/${receipt.versionId}.pdf` ||
    request.data.document_id !== receipt.documentId ||
    request.data.source_version_id !== receipt.versionId ||
    request.data.status !== "cancelled" ||
    !request.data.cancelled_at
  )
    throw new Error(
      "Signing cloud receipt reconciliation failed; retain fixtures for review.",
    );
  record.receipt.status = "cancelled";
  record.sourceObject = "one_verified_private_source";
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
    DVP_SIGNING_CLOUD_TEST: "1",
    DVP_SIGNING_CLOUD_RUN_ID: runId,
    DVP_SIGNING_CLOUD_PROOF: receiptPath,
  });
  for (const kind of kinds) {
    for (const field of ["id", "email", "password"])
      env[`DVP_SIGNING_CLOUD_${kind}_${field.toUpperCase()}`] =
        accounts[kind][field];
  }
  return new Promise((resolveExit) => {
    child = spawn(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "playwright.signing-cloud.config.ts",
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

try {
  if (!process.argv.includes("--confirm-persistent-fixture"))
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
      email: `dvp-signing-${kind.toLowerCase()}-${runId}@example.invalid`,
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
      !record.receipt &&
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
    console.log("Safe operator record: test-results/cloud-signing-run.json");
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
