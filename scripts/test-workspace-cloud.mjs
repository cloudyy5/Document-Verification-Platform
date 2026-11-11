import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Persistent-fixture acceptance is separate from the disposable login smoke.
const runId = randomUUID();
const fixtureSha256 =
  "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc";
const receiptPath = resolve("test-results", `cloud-workspace-${runId}.json`);
const lastReceiptPath = resolve("test-results/cloud-workspace-run.json");
const accounts = {};
let service;
let launched = false;
let failed = false;
let recordStarted = false;
const record = {
  runId,
  status: "preparing",
  fixtureSha256,
  fixtureBytes: 2831,
  ownerId: null,
  comparatorId: null,
  ownerDisposition: "not_created",
  comparatorDisposition: "not_created",
};
function fail(message) {
  console.error(message);
  failed = true;
}
async function saveRecord() {
  await mkdir(resolve("test-results"), { recursive: true });
  const json = `${JSON.stringify(record, null, 2)}\n`;
  await writeFile(receiptPath, json, { mode: 0o600 });
  await writeFile(lastReceiptPath, json, { mode: 0o600 });
  recordStarted = true;
}
async function createAccount(kind) {
  const email = `dvp-cloud-${kind}-${runId}@example.invalid`;
  const password = `${randomBytes(30).toString("base64url")}aA9!`;
  const result = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Uji Development Cloud",
      dvp_test_run: runId,
      dvp_test_actor: kind,
    },
  });
  const user = result.data?.user;
  if (
    user?.email === email &&
    user.user_metadata.dvp_test_run === runId &&
    user.user_metadata.dvp_test_actor === kind
  ) {
    accounts[kind] = { id: user.id, email, password };
    record[kind === "owner" ? "ownerId" : "comparatorId"] = user.id;
    record[`${kind}Disposition`] = "created";
    await saveRecord();
  }
  if (result.error || !accounts[kind])
    throw new Error("Synthetic account creation needs operator review.");
}
async function removeEmptyAccount(kind) {
  const account = accounts[kind];
  if (!account || !service) return;
  const field = `${kind}Disposition`;
  try {
    const check = await service.auth.admin.getUserById(account.id);
    const user = check.data?.user;
    if (
      check.error ||
      user?.email !== account.email ||
      user.user_metadata.dvp_test_run !== runId ||
      user.user_metadata.dvp_test_actor !== kind
    ) {
      record[field] = "ownership_check_requires_operator";
      fail("Synthetic cleanup ownership needs operator review.");
      return;
    }
    const [documents, submissions] = await Promise.all([
      service
        .from("documents")
        .select("id")
        .eq("owner_id", account.id)
        .limit(1),
      service
        .from("document_submissions")
        .select("id")
        .eq("submitted_by", account.id)
        .limit(1),
    ]);
    if (
      documents.error ||
      submissions.error ||
      !Array.isArray(documents.data) ||
      !Array.isArray(submissions.data) ||
      documents.data.length !== 0 ||
      submissions.data.length !== 0
    ) {
      record[field] = "retained_requires_operator";
      fail("Synthetic account retained; empty-account proof was unavailable.");
      return;
    }
    const deleted = await service.auth.admin.deleteUser(account.id);
    record[field] = deleted.error ? "cleanup_requires_operator" : "cleaned_up";
    if (deleted.error) fail("Synthetic cleanup needs operator review.");
  } catch {
    record[field] = "cleanup_requires_operator";
    fail("Synthetic cleanup could not complete; operator review is required.");
  }
}

try {
  const app = new URL(process.env.APP_URL ?? "");
  const backend = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (
    !process.argv.includes("--confirm-persistent-fixture") ||
    !["http:", "https:"].includes(app.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) ||
    (process.env.DOCUMENT_ENVIRONMENT ?? "development") !== "development" ||
    backend.protocol !== "https:" ||
    !backend.hostname.endsWith(".supabase.co") ||
    !publicKey ||
    !secretKey
  )
    throw new Error(
      "Explicit persistent-development-fixture confirmation is required.",
    );
  // A repeat invocation must not silently create a second permanent fixture.
  // Only a previous run with both known accounts explicitly cleaned is reusable.
  let priorRecord;
  try {
    priorRecord = JSON.parse(await readFile(lastReceiptPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT")
      throw new Error("Existing fixture proof requires operator review.", {
        cause: error,
      });
  }
  if (
    priorRecord !== undefined &&
    (!priorRecord ||
      priorRecord.receipt ||
      !priorRecord.ownerId ||
      !priorRecord.comparatorId ||
      ![
        "cleaned_up",
        "cleaned_up_after_confirmed_empty_failed_prevalidation",
      ].includes(priorRecord.ownerDisposition) ||
      priorRecord.comparatorDisposition !== "cleaned_up")
  )
    throw new Error("Existing fixture proof requires operator review.");
  const fixture = await readFile(
    resolve("tests/fixtures/phase-3-development.pdf"),
  );
  if (
    fixture.length !== 2831 ||
    createHash("sha256").update(fixture).digest("hex") !== fixtureSha256
  )
    throw new Error("The reviewed synthetic fixture does not match.");
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
          signal: AbortSignal.timeout(15000),
        }),
    },
  };
  service = createClient(backend.origin, secretKey, sdk);
  const readiness = await service.rpc("consume_document_upload_limit", {
    p_key_digest: "invalid",
    p_global_digest: "invalid",
  });
  if (readiness.error?.code !== "22023")
    throw new Error("Phase 3 schema is not ready; no account was created.");
  await saveRecord();
  await createAccount("owner");
  await createAccount("comparator");
  for (const account of Object.values(accounts)) {
    const user = createClient(backend.origin, publicKey, sdk);
    const signed = await user.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });
    if (signed.error) throw new Error("Synthetic account sign-in failed.");
    const roles = await user
      .from("user_roles")
      .select("role")
      .eq("user_id", account.id);
    const counts = await user.rpc("get_own_workspace_counts");
    if (
      roles.error ||
      roles.data?.length !== 1 ||
      roles.data[0]?.role !== "user" ||
      counts.error ||
      counts.data?.total !== 0
    )
      throw new Error("Synthetic owner baseline is not ready.");
    await user.auth.signOut({ scope: "local" });
  }
  record.status = "browser_starting";
  record.ownerDisposition = "retained_for_persistent_fixture_or_reconciliation";
  await saveRecord();
  // A request may commit even if its response/proof is lost. Never delete A
  // after launch, regardless of the eventual browser exit status.
  launched = true;
  const childEnvironment = { ...process.env };
  delete childEnvironment.SUPABASE_SECRET_KEY;
  delete childEnvironment.SUPABASE_SERVICE_ROLE_KEY;
  delete childEnvironment.AUTH_FLOW_SECRET;
  const exitCode = await new Promise((resolveExit) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        "--config",
        "playwright.cloud.config.ts",
      ],
      {
        cwd: process.cwd(),
        shell: false,
        windowsHide: true,
        stdio: "inherit",
        env: {
          ...childEnvironment,
          DVP_CLOUD_CONFIRM: "persistent-development-fixture",
          DVP_CLOUD_RUN_ID: runId,
          DVP_CLOUD_OWNER_ID: accounts.owner.id,
          DVP_CLOUD_OWNER_EMAIL: accounts.owner.email,
          DVP_CLOUD_OWNER_PASSWORD: accounts.owner.password,
          DVP_CLOUD_COMPARATOR_ID: accounts.comparator.id,
          DVP_CLOUD_COMPARATOR_EMAIL: accounts.comparator.email,
          DVP_CLOUD_COMPARATOR_PASSWORD: accounts.comparator.password,
        },
      },
    );
    child.once("error", () => resolveExit(1));
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
  const proof = JSON.parse(await readFile(receiptPath, "utf8"));
  if (proof.runId !== runId)
    throw new Error("Operator proof run marker does not match.");
  if (proof.receipt) record.receipt = proof.receipt;
  if (Array.isArray(proof.checks)) record.checks = proof.checks;
  const lastFailure = proof.lastFailure;
  if (
    lastFailure &&
    typeof lastFailure === "object" &&
    !Array.isArray(lastFailure) &&
    Number.isInteger(lastFailure.status) &&
    lastFailure.status >= 100 &&
    lastFailure.status <= 599
  ) {
    // Copy individual diagnostic fields only; never merge provider bodies.
    record.lastFailure = { status: lastFailure.status };
    if (
      typeof lastFailure.code === "string" &&
      /^[A-Z][A-Z0-9_]{0,63}$/.test(lastFailure.code)
    )
      record.lastFailure.code = lastFailure.code;
    if (
      typeof lastFailure.requestId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        lastFailure.requestId,
      )
    )
      record.lastFailure.requestId = lastFailure.requestId;
  }
  if (exitCode !== 0 || !record.receipt) {
    fail(
      "Cloud acceptance did not complete; retain the synthetic owner for reconciliation.",
    );
  } else {
    const credentials = await service
      .from("verification_credentials")
      .select("id", { count: "exact", head: true })
      .eq("document_id", record.receipt.documentId);
    if (credentials.error || credentials.count !== 0)
      fail("Pending-fixture credential absence could not be confirmed.");
    else record.verificationCredentials = "none_issued";
  }
} catch (error) {
  const allowed = [
    "Explicit persistent-development-fixture confirmation is required.",
    "Existing fixture proof requires operator review.",
    "The reviewed synthetic fixture does not match.",
    "Phase 3 schema is not ready; no account was created.",
    "Synthetic account creation needs operator review.",
    "Synthetic account sign-in failed.",
    "Synthetic owner baseline is not ready.",
    "Operator proof run marker does not match.",
  ];
  fail(
    allowed.includes(error?.message)
      ? error.message
      : "Cloud acceptance could not complete; no SDK details are logged.",
  );
} finally {
  await removeEmptyAccount("comparator");
  if (!launched) await removeEmptyAccount("owner");
  if (recordStarted) {
    record.status = failed
      ? "failed_requires_review"
      : "passed_with_persistent_fixture";
    try {
      await saveRecord();
    } catch {
      fail("The safe operator record could not be saved.");
    }
    console.log(`Development cloud acceptance run: ${runId}`);
    console.log("Safe operator record: test-results/cloud-workspace-run.json");
    if (launched)
      console.log(
        "Synthetic owner and any committed document are retained intentionally.",
      );
  }
}
process.exitCode = failed ? 1 : 0;
