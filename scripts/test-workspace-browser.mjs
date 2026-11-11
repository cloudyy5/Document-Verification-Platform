import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

// Explicit development-only smoke. Credentials exist only in process memory.
const confirmation = process.argv.includes("--confirm-development");
const checkProfile = process.argv.includes("--check-profile");
const allBrowserTests = process.argv.includes("--all");
const runId = randomUUID();
let service;
let createdId;
let createdEmail;
let failed = false;

function safeFailure(message) {
  console.error(message);
  failed = true;
}
try {
  const appUrl = new URL(process.env.APP_URL ?? "");
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (
    !confirmation ||
    !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname) ||
    (process.env.DOCUMENT_ENVIRONMENT ?? "development") !== "development" ||
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".supabase.co") ||
    !publicKey ||
    !secretKey
  ) {
    throw new Error(
      "Development configuration and --confirm-development are required.",
    );
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
          signal: AbortSignal.timeout(15000),
        }),
    },
  };
  service = createClient(url.origin, secretKey, sdk);
  // 008 rejects malformed values before any counter write.
  const readiness = await service.rpc("consume_document_upload_limit", {
    p_key_digest: "invalid",
    p_global_digest: "invalid",
  });
  if (readiness.error?.code !== "22023")
    throw new Error(
      "Phase 3 schema is not ready; no test account was created.",
    );
  createdEmail = `dvp-workspace-${runId}@example.invalid`;
  const password = `${randomBytes(30).toString("base64url")}aA9!`;
  const created = await service.auth.admin.createUser({
    email: createdEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Uji Development", dvp_test_run: runId },
  });
  if (
    created.error ||
    !created.data.user ||
    created.data.user.email !== createdEmail ||
    created.data.user.user_metadata.dvp_test_run !== runId
  )
    throw new Error(
      "Synthetic account setup failed. Review the development Auth audit if necessary.",
    );
  createdId = created.data.user.id;
  console.log(
    "Synthetic development account prepared; no email delivery is requested.",
  );
  const user = createClient(url.origin, publicKey, sdk);
  const signed = await user.auth.signInWithPassword({
    email: createdEmail,
    password,
  });
  if (signed.error) throw new Error("Synthetic account sign-in failed.");
  const counts = await user.rpc("get_own_workspace_counts");
  const roles = await user.from("user_roles").select("role");
  if (
    counts.error ||
    roles.error ||
    roles.data?.length !== 1 ||
    roles.data[0]?.role !== "user"
  )
    throw new Error("Owner-scoped workspace schema is not ready.");
  await user.auth.signOut({ scope: "local" });
  const browserArguments = ["node_modules/@playwright/test/cli.js", "test"];
  if (!allBrowserTests)
    browserArguments.push(
      "tests/e2e/workspace.spec.ts",
      "--grep",
      "workspace synthetic-account smoke",
    );
  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, browserArguments, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        DVP_E2E_AUTH_ENABLED: "1",
        DVP_E2E_AUTH_CONFIRM: "synthetic-development-account",
        DVP_E2E_AUTH_EMAIL: createdEmail,
        DVP_E2E_AUTH_PASSWORD: password,
        DVP_E2E_PROFILE_CHECK: checkProfile ? "1" : "0",
        DVP_E2E_TEMPORARY_RUN: runId,
      },
    });
    child.once("error", () => resolve(1));
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) failed = true;
} catch (error) {
  // Never forward SDK responses, command environments or credential arguments.
  const allowed = [
    "Development configuration and --confirm-development are required.",
    "Phase 3 schema is not ready; no test account was created.",
    "Synthetic account setup failed. Review the development Auth audit if necessary.",
    "Synthetic account sign-in failed.",
    "Owner-scoped workspace schema is not ready.",
  ];
  safeFailure(
    allowed.includes(error?.message)
      ? error.message
      : "Workspace smoke could not complete. No credential values are logged.",
  );
} finally {
  if (createdId && service) {
    try {
      const check = await service.auth.admin.getUserById(createdId);
      if (
        check.error ||
        check.data.user?.email !== createdEmail ||
        check.data.user?.user_metadata.dvp_test_run !== runId
      ) {
        safeFailure(
          `Synthetic account ownership needs operator review; test run ${runId}.`,
        );
      } else {
        const removed = await service.auth.admin.deleteUser(createdId);
        if (removed.error)
          safeFailure(
            `Synthetic account cleanup needs operator review; test run ${runId}.`,
          );
        else console.log("Synthetic development account cleaned up.");
      }
    } catch {
      safeFailure(
        `Synthetic account cleanup needs operator review; test run ${runId}.`,
      );
    }
  }
}
process.exitCode = failed ? 1 : 0;
