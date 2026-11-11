import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { resolve, sep, basename } from "node:path";
import { pathToFileURL } from "node:url";

const execute = promisify(execFile),
  root = resolve("test-results/runner-guards"),
  runner = resolve("scripts/test-signing-r3b-cloud.mjs");
let scratch = "";
beforeEach(async () => {
  await mkdir(root, { recursive: true });
  scratch = await mkdtemp(resolve(root, "r3-"));
  await mkdir(resolve(scratch, "test-results"));
});
afterEach(async () => {
  const target = resolve(scratch);
  if (
    !target.startsWith(`${root}${sep}`) ||
    !basename(target).startsWith("r3-")
  )
    throw new Error("Guard scratch cleanup escaped its workspace directory.");
  await rm(target, { recursive: true, force: true });
});
async function run(args: string[], selectedRunner = runner) {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
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
  Object.assign(env, {
    APP_URL: "http://127.0.0.1:3000",
    DOCUMENT_ENVIRONMENT: "development",
    NEXT_PUBLIC_SUPABASE_URL: "https://synthetic-r3-guard.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key-not-real",
    SUPABASE_SECRET_KEY: "synthetic-server-key-not-real",
  });
  const code = `let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Network disabled in guard test');};process.on('exit',()=>console.log('NETWORK_CALLS '+calls));process.argv=[process.execPath,${JSON.stringify(selectedRunner)},...${JSON.stringify(args)}];await import(${JSON.stringify(pathToFileURL(selectedRunner).href)});`;
  try {
    const result = await execute(
      process.execPath,
      ["--input-type=module", "--eval", code],
      {
        cwd: scratch,
        env,
        windowsHide: true,
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      },
    );
    return { ...result, code: 0 };
  } catch (error) {
    const result = error as { stdout: string; stderr: string; code: number };
    return result;
  }
}
describe("R3 runner invocation and persistent-proof guards (subprocess, network disabled)", () => {
  it("requires explicit opt-in before any network or fixture operation", async () => {
    const result = await run([]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("NETWORK_CALLS 0");
    expect(result.stderr).toContain(
      "Explicit persistent-development-fixture confirmation is required",
    );
  });
  it("does not remove or bypass another run's lock", async () => {
    const file = resolve(scratch, "test-results/cloud-signing-r3b.lock"),
      original = JSON.stringify({ runId: "other-run" });
    await writeFile(file, original);
    const result = await run(["--confirm-persistent-fixture"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("NETWORK_CALLS 0");
    expect(await readFile(file, "utf8")).toBe(original);
  });
  it("blocks a successful prior fixture before network and preserves its proof", async () => {
    const file = resolve(scratch, "test-results/cloud-signing-r3b-run.json"),
      original = JSON.stringify({
        schemaVersion: 4,
        status: "passed_with_persistent_fixture",
        receipts: { approve: { receiptId: "R".repeat(43) } },
      });
    await writeFile(file, original);
    const result = await run(["--confirm-persistent-fixture"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("NETWORK_CALLS 0");
    expect(await readFile(file, "utf8")).toBe(original);
  });
  it("finds an orphan partial proof even if the last-run pointer is missing", async () => {
    const file = resolve(
        scratch,
        "test-results/cloud-signing-r3b-71000000-0000-4000-8000-000000000001.json",
      ),
      original = JSON.stringify({
        schemaVersion: 4,
        status: "failed_requires_review",
        receipts: { reject: { documentId: "synthetic" } },
      });
    await writeFile(file, original);
    const result = await run(["--check-only"]);
    expect(result.code).toBe(1);
    expect(result.stdout).toContain("NETWORK_CALLS 0");
    expect(await readFile(file, "utf8")).toBe(original);
  });
  it("checks the reviewed PDF and empty guard offline without persistent fixtures", async () => {
    await mkdir(resolve(scratch, "tests/fixtures"), { recursive: true });
    await copyFile(
      resolve("tests/fixtures/signing-r3b-development.pdf"),
      resolve(scratch, "tests/fixtures/signing-r3b-development.pdf"),
    );
    const result = await run(["--check-only"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("offline check passed");
    expect(result.stdout).toContain("NETWORK_CALLS 0");
    await expect(
      readFile(resolve(scratch, "test-results/cloud-signing-r3b-run.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(resolve(scratch, "test-results/cloud-signing-r3b.lock")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
