import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import {
  appendFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const workspace = fileURLToPath(new URL("../", import.meta.url));
const stateRoot = path.join(workspace, ".postgres-test");
const argumentsList = process.argv.slice(2);
const cleanupOnly = argumentsList[0] === "--cleanup-run";
const requestedRunId = cleanupOnly ? argumentsList[1] : undefined;
const validRunId =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const runId =
  cleanupOnly && validRunId.test(requestedRunId ?? "")
    ? requestedRunId
    : randomUUID();
const clusterRoot = path.join(stateRoot, runId);
const dataDirectory = path.join(clusterRoot, "data");
const markerPath = path.join(clusterRoot, ".dvp-ephemeral-test");
const password = randomBytes(36).toString("base64url");
const isWindows = process.platform === "win32";
const generateTypes = process.argv.includes("--generate-types");
let databaseUrl;
let nativeDirectory;
let activeChild;
let activeClient;
let clusterCreated = false;
let interrupted = false;

// Every connection is constructed here. Input DATABASE_URL/PGHOST values are
// never used, so this command cannot migrate or reset an existing database.
const nativeEnvironment = { ...process.env };
for (const key of Object.keys(nativeEnvironment)) {
  if (
    key.startsWith("PG") ||
    key.startsWith("SUPABASE_") ||
    key.startsWith("NEXT_PUBLIC_SUPABASE_") ||
    [
      "DATABASE_URL",
      "DIRECT_URL",
      "DATABASE_TEST_URL",
      "DVP_DATABASE_TEST_ISOLATED",
      "DVP_TEST_PG_BIN",
    ].includes(key)
  ) {
    delete nativeEnvironment[key];
  }
}

function sanitized(value) {
  let output = String(value ?? "");
  for (const secret of [databaseUrl, password].filter(Boolean)) {
    output = output.split(secret).join("[redacted]");
  }
  return output.replace(
    /postgres(?:ql)?:\/\/[^\s"'<>]+/gi,
    "[redacted database URL]",
  );
}

function binary(name) {
  return path.join(nativeDirectory, `${name}${isWindows ? ".exe" : ""}`);
}

async function findNativeDirectory() {
  const candidates = process.env.PG_BIN
    ? [process.env.PG_BIN]
    : [
        ...(isWindows ? ["C:\\Program Files\\PostgreSQL\\17\\bin"] : []),
        ...(process.env.PATH ?? "").split(path.delimiter),
      ];
  for (const candidate of candidates.filter(Boolean)) {
    const resolved = path.resolve(candidate);
    const available = await Promise.all(
      ["initdb", "pg_ctl", "postgres"].map(async (name) => {
        try {
          return (
            await stat(path.join(resolved, `${name}${isWindows ? ".exe" : ""}`))
          ).isFile();
        } catch {
          return false;
        }
      }),
    );
    if (available.every(Boolean)) return resolved;
  }
  throw new Error(
    "PostgreSQL 17+ native binaries are required. Set PG_BIN to the directory containing initdb, pg_ctl, and postgres. Existing PostgreSQL services are never used.",
  );
}

function assertNotInterrupted() {
  if (interrupted) throw new Error("Database checks interrupted.");
}

function execute(
  command,
  args,
  {
    input,
    stream = false,
    timeout = 120_000,
    cleanup = false,
    successCodes = [0],
  } = {},
) {
  if (!cleanup) assertNotInterrupted();
  return new Promise((resolve, reject) => {
    // A started postgres descendant can inherit pg_ctl's pipe handles on
    // Windows. Ignoring stdio lets pg_ctl close immediately after it exits;
    // server diagnostics are written only to this run's postgres.log.
    const isControl = /^pg_ctl(?:\.exe)?$/i.test(path.basename(command));
    const child = spawn(command, args, {
      cwd: workspace,
      windowsHide: true,
      shell: false,
      env: stream
        ? {
            ...nativeEnvironment,
            DATABASE_TEST_URL: databaseUrl,
            DVP_DATABASE_TEST_ISOLATED: "1",
            DVP_TEST_PG_BIN: nativeDirectory,
          }
        : nativeEnvironment,
      stdio: isControl ? "ignore" : ["pipe", "pipe", "pipe"],
    });
    activeChild = child;
    let output = "";
    let pendingOutput = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);

    function receive(chunk) {
      const text = chunk.toString("utf8");
      output = (output + text).slice(-64_000);
      if (!stream) return;
      pendingOutput += text;
      const lines = pendingOutput.split(/\r?\n/);
      pendingOutput = lines.pop() ?? "";
      for (const line of lines) process.stdout.write(`${sanitized(line)}\n`);
    }

    child.stdout?.on("data", receive);
    child.stderr?.on("data", receive);
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
    child.once("error", (error) => {
      clearTimeout(timer);
      if (activeChild === child) activeChild = undefined;
      reject(
        new Error(
          `${path.basename(command)} could not run: ${sanitized(error.message)}`,
        ),
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (activeChild === child) activeChild = undefined;
      if (stream && pendingOutput)
        process.stdout.write(`${sanitized(pendingOutput)}\n`);
      if (successCodes.includes(code) && !timedOut) {
        resolve({ code, output: sanitized(output) });
        return;
      }
      const detail = sanitized(output)
        .trim()
        .split(/\r?\n/)
        .slice(-7)
        .join("\n");
      reject(
        new Error(
          `${path.basename(command)} ${timedOut ? "timed out" : `exited with code ${code ?? "unknown"}`}.${detail ? `\n${detail}` : ""}`,
        ),
      );
    });
  });
}

async function freeLoopbackPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = server.address();
  const port =
    address && typeof address === "object" ? address.port : undefined;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (!port)
    throw new Error(
      "Could not reserve a loopback port for the isolated database.",
    );
  return port;
}

async function initializeCluster() {
  const args = [
    "--pgdata",
    dataDirectory,
    "--username",
    "postgres",
    "--encoding",
    "UTF8",
    "--locale",
    "C",
    "--auth",
    "scram-sha-256",
    "--no-instructions",
  ];

  if (!isWindows) {
    // initdb uses fopen(), so '-' is not a stdin alias. /dev/stdin is.
    await execute(binary("initdb"), [...args, "--pwfile=/dev/stdin"], {
      input: `${password}\n`,
    });
    return;
  }

  // Windows fopen() can read a named pipe. The password remains in memory,
  // never in a file, a command argument, process output, or the source tree.
  const pipeName = `\\\\.\\pipe\\dvp-postgres-init-${randomUUID()}`;
  const pipe = net.createServer((socket) => {
    socket.on("error", () => {});
    socket.end(`${password}\n`);
  });
  pipe.maxConnections = 1;
  await new Promise((resolve, reject) => {
    pipe.once("error", reject);
    pipe.listen(pipeName, resolve);
  });
  try {
    await execute(binary("initdb"), [...args, `--pwfile=${pipeName}`]);
  } finally {
    await new Promise((resolve) => pipe.close(resolve));
  }
}

async function verifyCreatedDirectory() {
  if (!clusterCreated) return false;
  const workspaceReal = await realpath(workspace);
  const stateReal = await realpath(stateRoot);
  const clusterReal = await realpath(clusterRoot);
  if (
    path.relative(workspaceReal, stateReal) !== ".postgres-test" ||
    path.dirname(clusterReal) !== stateReal ||
    path.basename(clusterReal) !== runId ||
    (await lstat(clusterRoot)).isSymbolicLink() ||
    (await readFile(markerPath, "utf8")) !== runId
  ) {
    throw new Error(
      "Refusing cleanup: generated database directory failed its workspace ownership checks.",
    );
  }
  return true;
}

async function cleanOwnedCluster() {
  if (!(await verifyCreatedDirectory())) return;
  let pidExists = false;
  try {
    pidExists = (
      await stat(path.join(dataDirectory, "postmaster.pid"))
    ).isFile();
  } catch {
    // initdb may have failed before a server was started.
  }
  if (pidExists) {
    const status = await execute(
      binary("pg_ctl"),
      ["--pgdata", dataDirectory, "status"],
      { cleanup: true, successCodes: [0, 3] },
    );
    if (status.code === 0) {
      await execute(
        binary("pg_ctl"),
        [
          "--pgdata",
          dataDirectory,
          "--mode",
          "immediate",
          "--wait",
          "--timeout",
          "30",
          "stop",
        ],
        { cleanup: true, timeout: 40_000 },
      );
    }
  }
  await verifyCreatedDirectory();
  await rm(clusterRoot, {
    recursive: true,
    force: false,
    maxRetries: 4,
    retryDelay: 250,
  });
  clusterCreated = false;
  console.log("Isolated database stopped; generated cluster removed.");
}

function onSignal() {
  interrupted = true;
  activeChild?.kill();
  void activeClient?.end().catch(() => {});
}

process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

try {
  if (
    cleanupOnly
      ? argumentsList.length !== 2 || !validRunId.test(requestedRunId ?? "")
      : argumentsList.length > 1 ||
        argumentsList.some((argument) => argument !== "--generate-types")
  ) {
    throw new Error(
      "Unsupported database check argument. Usage: node scripts/test-database.mjs [--generate-types | --cleanup-run <generated UUID>]. Cleanup accepts only a UUID directory bearing this harness's ownership marker under .postgres-test.",
    );
  }
  nativeDirectory = await findNativeDirectory();
  const version = (
    await execute(binary("postgres"), ["--version"])
  ).output.trim();
  const major = Number(version.match(/PostgreSQL\)?\s+(\d+)/)?.[1]);
  if (!Number.isInteger(major) || major < 17) {
    throw new Error("Database checks require PostgreSQL 17 or newer.");
  }
  if (cleanupOnly) {
    clusterCreated = true;
    await cleanOwnedCluster();
  } else {
    console.log(`${version} — isolated loopback-only test cluster.`);
    console.log(
      "Supabase auth/storage schemas below are metadata fixtures; no GoTrue, PostgREST, or Storage HTTP services are simulated as connected.",
    );

    await mkdir(stateRoot, { recursive: true, mode: 0o700 });
    if (
      path.relative(await realpath(workspace), await realpath(stateRoot)) !==
        ".postgres-test" ||
      (await lstat(stateRoot)).isSymbolicLink()
    ) {
      throw new Error(
        "Refusing to create a database cluster outside the workspace test directory.",
      );
    }
    await mkdir(clusterRoot, { mode: 0o700 });
    clusterCreated = true;
    await writeFile(markerPath, runId, { mode: 0o600, flag: "wx" });
    const port = await freeLoopbackPort();
    databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`;
    await initializeCluster();
    await appendFile(
      path.join(dataDirectory, "postgresql.conf"),
      `\n# Isolated DVP tests only\nlisten_addresses = '127.0.0.1'\nport = ${port}\nunix_socket_directories = ''\nmax_connections = 40\nshared_buffers = '32MB'\nlog_statement = 'none'\nlog_min_error_statement = 'panic'\n`,
    );
    await execute(
      binary("pg_ctl"),
      [
        "--pgdata",
        dataDirectory,
        "--log",
        path.join(clusterRoot, "postgres.log"),
        "--wait",
        "--timeout",
        "30",
        "start",
      ],
      { timeout: 40_000 },
    );

    activeClient = new Client({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
      ssl: false,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
    });
    await activeClient.connect();
    await activeClient.query(
      await readFile(
        path.join(workspace, "tests/database/bootstrap.sql"),
        "utf8",
      ),
    );
    const migrationDirectory = path.join(workspace, "supabase/migrations");
    const migrations = (await readdir(migrationDirectory))
      .filter((name) => /^\d+_[a-zA-Z0-9_-]+\.sql$/.test(name))
      .sort();
    if (!migrations.length)
      throw new Error("No application migrations were found.");
    for (const migration of migrations) {
      assertNotInterrupted();
      console.log(`Applying ${migration}`);
      await activeClient.query(
        await readFile(path.join(migrationDirectory, migration), "utf8"),
      );
    }
    const seedPath = path.join(workspace, "supabase/seed.sql");
    try {
      const seed = await readFile(seedPath, "utf8");
      await activeClient.query(seed);
      console.log("Applied development category seed.");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (generateTypes) {
      const { renderDatabaseTypes } = await import("./database-types.mjs");
      const source = await renderDatabaseTypes(activeClient);
      const typeDirectory = path.join(workspace, "src/types");
      await mkdir(typeDirectory, { recursive: true });
      await writeFile(path.join(typeDirectory, "database.ts"), source, "utf8");
      console.log(
        "Generated src/types/database.ts from the migrated isolated database.",
      );
    }
    await activeClient.end();
    activeClient = undefined;
    if (!generateTypes) {
      await execute(
        process.execPath,
        [
          path.join(workspace, "node_modules/vitest/vitest.mjs"),
          "run",
          "--config",
          "vitest.database.config.ts",
        ],
        { stream: true, timeout: 300_000 },
      );
    }
  }
} catch (error) {
  process.exitCode = 1;
  console.error(
    `Database checks failed: ${sanitized(error?.message ?? error)}`,
  );
} finally {
  if (activeClient) {
    await activeClient.end().catch(() => {});
    activeClient = undefined;
  }
  try {
    await cleanOwnedCluster();
  } catch (error) {
    process.exitCode = 1;
    console.error(
      `Isolated database cleanup failed: ${sanitized(error?.message ?? error)}`,
    );
    if (clusterCreated) {
      console.error(
        `Retry owned-cluster cleanup: node scripts/test-database.mjs --cleanup-run ${runId}`,
      );
    }
  }
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
}
