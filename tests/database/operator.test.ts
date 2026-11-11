import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_TEST_URL;
const nativeDirectory = process.env.DVP_TEST_PG_BIN;
if (
  !databaseUrl ||
  !nativeDirectory ||
  process.env.DVP_DATABASE_TEST_ISOLATED !== "1"
) {
  throw new Error(
    "Run operator tests through npm run test:db (isolated runner).",
  );
}
let localUrl: URL;
try {
  localUrl = new URL(databaseUrl);
} catch {
  throw new Error("The isolated operator test configuration is invalid.");
}
if (localUrl.hostname !== "127.0.0.1" || localUrl.pathname !== "/postgres") {
  throw new Error(
    "Operator tests may target only the isolated loopback cluster.",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  allowExitOnIdle: true,
});
const psql = path.join(
  nativeDirectory,
  process.platform === "win32" ? "psql.exe" : "psql",
);
const operatorFile = path.resolve("supabase/operators/grant-role.sql");

type OperatorVariables = {
  target_user_id?: string;
  granted_role?: string;
  operator_user_id?: string;
};

async function createUser() {
  const id = randomUUID();
  await pool.query(
    "insert into auth.users (id, raw_user_meta_data) values ($1, $2::jsonb)",
    [id, JSON.stringify({ full_name: "Synthetic operator test account" })],
  );
  return id;
}

function runOperator(
  variables: OperatorVariables,
  apiRole?: "anon" | "authenticated" | "service_role",
) {
  // Password goes only through this child process environment, never argv or
  // a command string. Clear inherited libpq options before specifying a fresh
  // loopback cluster; this runner has no remote connection mode.
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("PG")) delete environment[key];
  }
  environment.PGPASSWORD = decodeURIComponent(localUrl.password);
  environment.PGCONNECT_TIMEOUT = "5";
  environment.PGCLIENTENCODING = "UTF8";

  const args = [
    "-X",
    "--no-password",
    "--host",
    "127.0.0.1",
    "--port",
    localUrl.port,
    "--username",
    "postgres",
    "--dbname",
    "postgres",
    "--set=ON_ERROR_STOP=on",
    ...Object.entries(variables).map(
      ([name, value]) => `--set=${name}=${value}`,
    ),
    ...(apiRole ? ["--command", `set role ${apiRole}`] : []),
    "--file",
    operatorFile,
  ];

  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(psql, args, {
      shell: false,
      windowsHide: true,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => child.kill(), 8_000);
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.once("error", () => {
      clearTimeout(timer);
      reject(
        new Error("The isolated psql operator test process could not start."),
      );
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, output });
    });
  });
}

async function privilegedRolesFor(user: string) {
  return (
    await pool.query(
      "select role, granted_by, created_at from public.user_roles where user_id = $1 and role <> 'user' order by role",
      [user],
    )
  ).rows;
}

async function grantsAuditFor(user: string) {
  return (
    await pool.query(
      "select actor_user_id, metadata from public.audit_logs where action = 'role.granted' and resource_id = $1 order by id",
      [user],
    )
  ).rows;
}

afterAll(async () => {
  await pool.end();
});

describe("trusted database operator role grant script", () => {
  it("grants approved operator roles with one audit event and preserves duplicate attribution", async () => {
    const operator = await createUser();
    const anotherOperator = await createUser();
    for (const grantedRole of ["reviewer", "platform_admin"]) {
      const target = await createUser();
      const first = await runOperator({
        target_user_id: target,
        granted_role: grantedRole,
        operator_user_id: operator,
      });
      expect(first.code).toBe(0);
      expect(first.output).toContain("ROLE_GRANTED");
      const stored = await privilegedRolesFor(target);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        role: grantedRole,
        granted_by: operator,
      });
      expect(await grantsAuditFor(target)).toEqual([
        {
          actor_user_id: operator,
          metadata: { role: grantedRole, changed: true },
        },
      ]);

      const duplicate = await runOperator({
        target_user_id: target,
        granted_role: grantedRole,
        operator_user_id: anotherOperator,
      });
      expect(duplicate.code).toBe(0);
      expect(duplicate.output).toContain("ROLE_ALREADY_PRESENT");
      expect(await privilegedRolesFor(target)).toEqual(stored);
      expect(await grantsAuditFor(target)).toHaveLength(1);
    }
  });

  it("refuses API roles even with valid identities and leaves no privileged grant or audit", async () => {
    const operator = await createUser();
    for (const apiRole of ["anon", "authenticated", "service_role"] as const) {
      const target = await createUser();
      const result = await runOperator(
        {
          target_user_id: target,
          granted_role: "reviewer",
          operator_user_id: operator,
        },
        apiRole,
      );
      expect(result.code).toBeGreaterThan(0);
      expect(result.output).toContain("TRUSTED_DATABASE_OPERATOR_REQUIRED");
      expect(await privilegedRolesFor(target)).toEqual([]);
      expect(await grantsAuditFor(target)).toEqual([]);
    }
  });

  it("rejects missing or invalid inputs and treats SQL-looking values as data", async () => {
    const operator = await createUser();
    const target = await createUser();
    const cases: { variables: OperatorVariables; error: string }[] = [
      {
        variables: { target_user_id: target, operator_user_id: operator },
        error: "ROLE_NOT_OPERATOR_ASSIGNABLE",
      },
      {
        variables: {
          target_user_id: target,
          granted_role: "user",
          operator_user_id: operator,
        },
        error: "ROLE_NOT_OPERATOR_ASSIGNABLE",
      },
      {
        variables: {
          target_user_id: target,
          granted_role: "reviewer'; delete from public.user_roles; --",
          operator_user_id: operator,
        },
        error: "ROLE_NOT_OPERATOR_ASSIGNABLE",
      },
      {
        variables: {
          target_user_id: "not-a-uuid'; truncate public.user_roles; --",
          granted_role: "reviewer",
          operator_user_id: operator,
        },
        error: "VALID_TARGET_USER_ID_REQUIRED",
      },
      {
        variables: { target_user_id: target, granted_role: "reviewer" },
        error: "VALID_OPERATOR_USER_ID_REQUIRED",
      },
    ];
    for (const { variables, error } of cases) {
      const result = await runOperator(variables);
      expect(result.code).toBeGreaterThan(0);
      expect(result.output).toContain(error);
      expect(await privilegedRolesFor(target)).toEqual([]);
      expect(await grantsAuditFor(target)).toEqual([]);
    }
    expect(
      (
        await pool.query(
          "select role from public.user_roles where user_id = $1",
          [target],
        )
      ).rows,
    ).toEqual([{ role: "user" }]);
  });

  it("rejects unknown target or operator accounts without partial writes", async () => {
    const operator = await createUser();
    const target = await createUser();
    const missingTarget = randomUUID();
    const unknownTarget = await runOperator({
      target_user_id: missingTarget,
      granted_role: "reviewer",
      operator_user_id: operator,
    });
    expect(unknownTarget.code).toBeGreaterThan(0);
    expect(unknownTarget.output).toContain("TARGET_USER_NOT_FOUND");
    expect(await privilegedRolesFor(missingTarget)).toEqual([]);
    expect(await grantsAuditFor(missingTarget)).toEqual([]);

    const unknownOperator = await runOperator({
      target_user_id: target,
      granted_role: "reviewer",
      operator_user_id: randomUUID(),
    });
    expect(unknownOperator.code).toBeGreaterThan(0);
    expect(unknownOperator.output).toContain("OPERATOR_USER_NOT_FOUND");
    expect(await privilegedRolesFor(target)).toEqual([]);
    expect(await grantsAuditFor(target)).toEqual([]);
  });
});
