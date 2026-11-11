import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

// Native PostgreSQL tests cover SQL authority and atomicity. They do not
// simulate GoTrue, email delivery, JWT signatures, or PostgREST transport.
const databaseUrl = process.env.DATABASE_TEST_URL;
if (!databaseUrl || process.env.DVP_DATABASE_TEST_ISOLATED !== "1") {
  throw new Error("Run authentication database tests through npm run test:db.");
}
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/postgres") {
  throw new Error(
    "Database tests may target only the isolated loopback cluster.",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  allowExitOnIdle: true,
});

type ApiRole = "anon" | "authenticated" | "service_role";
type SqlRole = ApiRole | "postgres";
const digest = () => createHash("sha256").update(randomUUID()).digest("hex");

async function actor(connection: PoolClient, role: SqlRole, userId?: string) {
  await connection.query(`set local role ${role}`);
  await connection.query(
    "select set_config('request.jwt.claim.sub', $1, true)",
    [userId ?? ""],
  );
  await connection.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(userId ? { role, sub: userId } : { role }),
  ]);
}

async function transaction(run: (connection: PoolClient) => Promise<void>) {
  const connection = await pool.connect();
  try {
    await connection.query("begin");
    await run(connection);
  } finally {
    await connection.query("rollback");
    connection.release();
  }
}

async function expectSqlError(
  connection: PoolClient,
  sql: string,
  values: unknown[] = [],
  state = "42501",
  message?: string,
) {
  await connection.query("savepoint expected_denial");
  let failure: unknown;
  try {
    await connection.query(sql, values);
  } catch (error) {
    failure = error;
  } finally {
    await connection.query("rollback to savepoint expected_denial");
    await connection.query("release savepoint expected_denial");
  }
  expect(failure, "The database must reject this operation").toBeInstanceOf(
    Error,
  );
  expect((failure as { code?: string }).code).toBe(state);
  if (message) expect((failure as Error).message).toContain(message);
}

async function createUser(connection: PoolClient, verified = true) {
  const id = randomUUID();
  await connection.query(
    `insert into auth.users (id, raw_user_meta_data, email_confirmed_at)
     values ($1, $2::jsonb, case when $3 then now() else null end)`,
    [
      id,
      JSON.stringify({
        full_name: "Synthetic auth security fixture",
        email_verified: true,
        roles: ["platform_admin"],
      }),
      verified,
    ],
  );
  return id;
}

async function consumeRate(
  connection: PoolClient,
  action: string,
  key: string,
) {
  return (
    await connection.query<{ allowed: boolean }>(
      "select public.consume_auth_rate_limit($1, $2) as allowed",
      [action, key],
    )
  ).rows[0]!.allowed;
}

const rateLimits = [
  ["login", 10],
  ["register", 5],
  ["recovery", 3],
  ["resend", 3],
  ["reset", 5],
  ["login_global", 200],
  ["register_global", 100],
  ["recovery_global", 50],
  ["resend_global", 50],
  ["reset_global", 100],
] as const;

afterAll(async () => {
  await pool.end();
});

describe("persistent authentication rate limits", () => {
  it.each(rateLimits)(
    "enforces the %s threshold of %i without unbounded counters",
    async (action, limit) => {
      await transaction(async (connection) => {
        const key = digest();
        await actor(connection, "service_role");
        const accepted = await connection.query<{ allowed: boolean }>(
          "select public.consume_auth_rate_limit($1, $2) as allowed from generate_series(1, $3::integer)",
          [action, key, limit],
        );
        expect(accepted.rows).toHaveLength(limit);
        expect(accepted.rows.every((row) => row.allowed)).toBe(true);
        expect(await consumeRate(connection, action, key)).toBe(false);
        expect(await consumeRate(connection, action, key)).toBe(false);
        await actor(connection, "postgres");
        expect(
          (
            await connection.query(
              "select hits from private.auth_rate_limits where action = $1 and key_digest = $2",
              [action, key],
            )
          ).rows,
        ).toEqual([{ hits: limit + 1 }]);
      });
    },
  );

  it("retains consumed attempts across separate committed database sessions", async () => {
    const key = digest();
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      const firstPid = (await first.query("select pg_backend_pid() as pid"))
        .rows[0].pid;
      const secondPid = (await second.query("select pg_backend_pid() as pid"))
        .rows[0].pid;
      expect(firstPid).not.toBe(secondPid);
      await first.query("begin");
      await actor(first, "service_role");
      for (let index = 0; index < 4; index++)
        expect(await consumeRate(first, "login", key)).toBe(true);
      await first.query("commit");
      await second.query("begin");
      await actor(second, "service_role");
      for (let index = 0; index < 6; index++)
        expect(await consumeRate(second, "login", key)).toBe(true);
      expect(await consumeRate(second, "login", key)).toBe(false);
      await second.query("commit");
    } finally {
      await first.query("rollback");
      await second.query("rollback");
      first.release();
      second.release();
      await pool.query(
        "delete from private.auth_rate_limits where action = 'login' and key_digest = $1",
        [key],
      );
    }
  });

  it("admits at most ten concurrent login attempts for the same key", async () => {
    const key = digest();
    try {
      const results = await Promise.all(
        Array.from({ length: 16 }, async () => {
          const connection = await pool.connect();
          try {
            await connection.query("begin");
            await actor(connection, "service_role");
            const allowed = await consumeRate(connection, "login", key);
            await connection.query("commit");
            return allowed;
          } finally {
            await connection.query("rollback");
            connection.release();
          }
        }),
      );
      expect(results.filter(Boolean)).toHaveLength(10);
      expect(results.filter((allowed) => !allowed)).toHaveLength(6);
    } finally {
      await pool.query(
        "delete from private.auth_rate_limits where action = 'login' and key_digest = $1",
        [key],
      );
    }
  });

  it.each([
    ["login", "16 minutes"],
    ["register", "61 minutes"],
  ] as const)(
    "renews the expired %s window instead of retaining its block",
    async (action, elapsed) => {
      await transaction(async (connection) => {
        const key = digest();
        await actor(connection, "service_role");
        expect(await consumeRate(connection, action, key)).toBe(true);
        await actor(connection, "postgres");
        await connection.query(
          "update private.auth_rate_limits set hits = 999, window_started_at = now() - $3::interval where action = $1 and key_digest = $2",
          [action, key, elapsed],
        );
        await actor(connection, "service_role");
        expect(await consumeRate(connection, action, key)).toBe(true);
        await actor(connection, "postgres");
        expect(
          (
            await connection.query(
              "select hits, window_started_at > now() - interval '1 minute' as fresh from private.auth_rate_limits where action = $1 and key_digest = $2",
              [action, key],
            )
          ).rows,
        ).toEqual([{ hits: 1, fresh: true }]);
      });
    },
  );

  it("keeps actions and keys independent and cleans only stale counters", async () => {
    await transaction(async (connection) => {
      const key = digest();
      const staleKey = digest();
      await connection.query(
        "insert into private.auth_rate_limits values ('login', $1, 10, now() - interval '2 days')",
        [staleKey],
      );
      await actor(connection, "service_role");
      for (let index = 0; index < 3; index++)
        expect(await consumeRate(connection, "recovery", key)).toBe(true);
      expect(await consumeRate(connection, "recovery", key)).toBe(false);
      expect(await consumeRate(connection, "resend", key)).toBe(true);
      expect(await consumeRate(connection, "recovery", digest())).toBe(true);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select * from private.auth_rate_limits where key_digest = $1",
            [staleKey],
          )
        ).rowCount,
      ).toBe(0);
    });
  });

  it.each([
    [null, "a".repeat(64)],
    ["", "a".repeat(64)],
    ["unknown", "a".repeat(64)],
    ["login", null],
    ["login", ""],
    ["login", "synthetic@example.invalid"],
    ["login", "a".repeat(63)],
    ["login", "a".repeat(65)],
    ["login", "A".repeat(64)],
    ["login'; delete from private.auth_rate_limits; --", "a".repeat(64)],
  ])("rejects malformed input %j / %j", async (action, key) => {
    await transaction(async (connection) => {
      await actor(connection, "service_role");
      await expectSqlError(
        connection,
        "select public.consume_auth_rate_limit($1, $2)",
        [action, key],
        "22023",
        "INVALID_RATE_LIMIT_INPUT",
      );
    });
  });
});

const privateTables = ["auth_rate_limits", "auth_recovery_grants"] as const;
const apiRoles = ["anon", "authenticated", "service_role"] as const;

describe("authentication tables remain inaccessible to every API role", () => {
  it.each(privateTables)("keeps RLS enabled for private.%s", async (table) => {
    expect(
      (
        await pool.query(
          "select relrowsecurity from pg_class where oid = $1::regclass",
          [`private.${table}`],
        )
      ).rows,
    ).toEqual([{ relrowsecurity: true }]);
  });

  describe.each(apiRoles)("%s", (role) => {
    it.each(privateTables)(
      "cannot read or mutate private.%s directly",
      async (table) => {
        await transaction(async (connection) => {
          await actor(connection, role);
          const column = table === "auth_rate_limits" ? "hits" : "used_at";
          for (const sql of [
            `select * from private.${table}`,
            `insert into private.${table} default values`,
            `update private.${table} set ${column} = ${column}`,
            `delete from private.${table}`,
            `truncate private.${table}`,
          ])
            await expectSqlError(connection, sql);
        });
      },
    );
  });
});

const serverFunctions = [
  [
    "consume_auth_rate_limit",
    "select public.consume_auth_rate_limit('login', $1)",
    ["a".repeat(64)],
  ],
  [
    "issue_auth_recovery_grant",
    "select public.issue_auth_recovery_grant($1, $2::uuid, $3::uuid)",
    ["a".repeat(64), randomUUID(), randomUUID()],
  ],
  [
    "is_auth_recovery_grant_valid",
    "select public.is_auth_recovery_grant_valid($1, $2::uuid, $3::uuid)",
    ["a".repeat(64), randomUUID(), randomUUID()],
  ],
  [
    "consume_auth_recovery_grant",
    "select public.consume_auth_recovery_grant($1, $2::uuid, $3::uuid)",
    ["a".repeat(64), randomUUID(), randomUUID()],
  ],
] as const;

describe.each(["anon", "authenticated"] as const)(
  "%s cannot invoke trusted-server auth RPCs",
  (role) => {
    it.each(serverFunctions)("denies %s", async (_name, sql, parameters) => {
      await transaction(async (connection) => {
        await actor(connection, role);
        await expectSqlError(connection, sql, [...parameters]);
      });
    });
  },
);

async function recoveryCall(
  connection: PoolClient,
  operation: "issue" | "is" | "consume",
  token: string,
  user: string,
  session: string,
) {
  const name =
    operation === "is"
      ? "is_auth_recovery_grant_valid"
      : `${operation}_auth_recovery_grant`;
  return (
    await connection.query<{ result: boolean | null }>(
      `select public.${name}($1, $2::uuid, $3::uuid) as result`,
      [token, user, session],
    )
  ).rows[0]!.result;
}

describe("short-lived recovery grants", () => {
  it("allows only one committed consumption when recovery requests race", async () => {
    const issuer = await pool.connect();
    const token = digest();
    const session = randomUUID();
    let user: string | undefined;
    try {
      await issuer.query("begin");
      user = await createUser(issuer);
      await actor(issuer, "service_role");
      await recoveryCall(issuer, "issue", token, user, session);
      await issuer.query("commit");
    } finally {
      await issuer.query("rollback");
      issuer.release();
    }
    try {
      const attempts = await Promise.allSettled(
        Array.from({ length: 8 }, async () => {
          const connection = await pool.connect();
          try {
            await connection.query("begin");
            await actor(connection, "service_role");
            const consumed = await recoveryCall(
              connection,
              "consume",
              token,
              user!,
              session,
            );
            await connection.query("commit");
            return consumed;
          } finally {
            await connection.query("rollback");
            connection.release();
          }
        }),
      );
      expect(attempts.every((attempt) => attempt.status === "fulfilled")).toBe(
        true,
      );
      const successful = attempts.filter(
        (attempt) => attempt.status === "fulfilled" && attempt.value === true,
      );
      expect(successful).toHaveLength(1);
    } finally {
      await pool.query("delete from auth.users where id = $1", [user]);
    }
  });

  it("binds every check and single-use consumption to the exact user and session even for service_role", async () => {
    await transaction(async (connection) => {
      const user = await createUser(connection);
      const otherUser = await createUser(connection);
      const session = randomUUID();
      const otherSession = randomUUID();
      const token = digest();
      await actor(connection, "service_role");
      await recoveryCall(connection, "issue", token, user, session);
      expect(await recoveryCall(connection, "is", token, user, session)).toBe(
        true,
      );
      for (const [candidateToken, candidateUser, candidateSession] of [
        [digest(), user, session],
        [token, otherUser, session],
        [token, user, otherSession],
      ]) {
        expect(
          await recoveryCall(
            connection,
            "is",
            candidateToken!,
            candidateUser!,
            candidateSession!,
          ),
        ).toBe(false);
        expect(
          await recoveryCall(
            connection,
            "consume",
            candidateToken!,
            candidateUser!,
            candidateSession!,
          ),
        ).toBe(false);
      }
      expect(await recoveryCall(connection, "is", token, user, session)).toBe(
        true,
      );
      expect(
        await recoveryCall(connection, "consume", token, user, session),
      ).toBe(true);
      expect(await recoveryCall(connection, "is", token, user, session)).toBe(
        false,
      );
      expect(
        await recoveryCall(connection, "consume", token, user, session),
      ).toBe(false);
    });
  });

  it("expires after the server-controlled ten-minute lifetime and cannot consume an expired grant", async () => {
    await transaction(async (connection) => {
      const user = await createUser(connection);
      const session = randomUUID();
      const token = digest();
      await actor(connection, "service_role");
      await recoveryCall(connection, "issue", token, user, session);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select expires_at > now() as active, expires_at <= now() + interval '10 minutes' as bounded from private.auth_recovery_grants where token_digest = $1",
            [token],
          )
        ).rows,
      ).toEqual([{ active: true, bounded: true }]);
      await connection.query(
        "update private.auth_recovery_grants set expires_at = now() - interval '1 second' where token_digest = $1",
        [token],
      );
      await actor(connection, "service_role");
      expect(await recoveryCall(connection, "is", token, user, session)).toBe(
        false,
      );
      expect(
        await recoveryCall(connection, "consume", token, user, session),
      ).toBe(false);
    });
  });

  it("supersedes an earlier recovery session without cancelling another user's grant", async () => {
    await transaction(async (connection) => {
      const user = await createUser(connection);
      const otherUser = await createUser(connection);
      const oldSession = randomUUID();
      const newSession = randomUUID();
      const otherSession = randomUUID();
      const oldToken = digest();
      const newToken = digest();
      const otherToken = digest();
      await actor(connection, "service_role");
      await recoveryCall(connection, "issue", oldToken, user, oldSession);
      await recoveryCall(
        connection,
        "issue",
        otherToken,
        otherUser,
        otherSession,
      );
      await recoveryCall(connection, "issue", newToken, user, newSession);
      expect(
        await recoveryCall(connection, "is", oldToken, user, oldSession),
      ).toBe(false);
      expect(
        await recoveryCall(connection, "consume", oldToken, user, oldSession),
      ).toBe(false);
      expect(
        await recoveryCall(connection, "is", newToken, user, newSession),
      ).toBe(true);
      expect(
        await recoveryCall(
          connection,
          "is",
          otherToken,
          otherUser,
          otherSession,
        ),
      ).toBe(true);
    });
  });

  it.each(["token", "user", "session"] as const)(
    "rejects a missing or malformed recovery %s",
    async (missing) => {
      await transaction(async (connection) => {
        const user = await createUser(connection);
        await actor(connection, "service_role");
        await expectSqlError(
          connection,
          "select public.issue_auth_recovery_grant($1, $2::uuid, $3::uuid)",
          [
            missing === "token" ? "raw-token-must-never-be-stored" : digest(),
            missing === "user" ? null : user,
            missing === "session" ? null : randomUUID(),
          ],
          "22023",
          "INVALID_RECOVERY_GRANT",
        );
      });
    },
  );
});

const submissionSql = (
  resubmit = false,
) => `select public.create_document_${resubmit ? "resubmission" : "submission"}(
  $1::uuid, $2::uuid, $3::uuid, 'Synthetic authentication SQL fixture', $4::uuid,
  null::text, null::date, null::text, null::text, 'synthetic.pdf',
  123::bigint, $5::text, $6::text, 'test-policy', true) as submission`;

async function submissionFixture(connection: PoolClient, verified: boolean) {
  const user = await createUser(connection, verified);
  const document = randomUUID();
  const submission = randomUUID();
  const path = `${user}/${document}/initial.pdf`;
  const category = (
    await connection.query<{ id: string }>(
      "select id from public.document_categories where slug = 'pendidikan' and is_active = true",
    )
  ).rows[0]!.id;
  await connection.query(
    "insert into storage.objects (bucket_id, name) values ('document-submissions', $1)",
    [path],
  );
  return {
    user,
    document,
    submission,
    category,
    path,
    parameters: [user, document, submission, category, digest(), path],
  };
}

describe("R-04 verified email is required by SQL, including trusted-server writes", () => {
  it("rejects an initial submission from an unverified owner and leaves no partial document or audit", async () => {
    await transaction(async (connection) => {
      const fixture = await submissionFixture(connection, false);
      await actor(connection, "service_role", fixture.user);
      await connection.query(
        "select set_config('request.jwt.claims', $1, true)",
        [
          JSON.stringify({
            role: "service_role",
            sub: fixture.user,
            email_verified: true,
            user_metadata: { email_verified: true },
          }),
        ],
      );
      await expectSqlError(
        connection,
        submissionSql(),
        fixture.parameters,
        "42501",
        "EMAIL_VERIFICATION_REQUIRED",
      );
      for (const [table, column] of [
        ["documents", "id"],
        ["document_submissions", "document_id"],
        ["audit_logs", "resource_id"],
        ["verification_credentials", "document_id"],
      ]) {
        expect(
          (
            await connection.query(
              `select * from public.${table} where ${column} = $1`,
              [fixture.document],
            )
          ).rowCount,
        ).toBe(0);
      }
    });
  });

  it("allows a confirmed owner to submit while retaining pending status and issuing no credential", async () => {
    await transaction(async (connection) => {
      const fixture = await submissionFixture(connection, true);
      await actor(connection, "service_role", fixture.user);
      const result = await connection.query(
        submissionSql(),
        fixture.parameters,
      );
      expect(result.rows[0].submission).toMatchObject({
        documentId: fixture.document,
        submissionId: fixture.submission,
        versionNo: 1,
        status: "pending_review",
      });
      expect(
        (
          await connection.query(
            "select id from public.verification_credentials where document_id = $1",
            [fixture.document],
          )
        ).rowCount,
      ).toBe(0);
    });
  });

  it("rechecks current email verification on resubmission without advancing the document version", async () => {
    await transaction(async (connection) => {
      const fixture = await submissionFixture(connection, true);
      await actor(connection, "service_role", fixture.user);
      await connection.query(submissionSql(), fixture.parameters);
      await actor(connection, "postgres");
      await connection.query(
        "update public.document_submissions set status = 'revision_requested' where id = $1",
        [fixture.submission],
      );
      await connection.query(
        "update public.documents set current_status = 'revision_requested' where id = $1",
        [fixture.document],
      );
      await connection.query(
        "update auth.users set email_confirmed_at = null where id = $1",
        [fixture.user],
      );
      const revisedPath = `${fixture.user}/${fixture.document}/revised.pdf`;
      await connection.query(
        "insert into storage.objects (bucket_id, name) values ('document-submissions', $1)",
        [revisedPath],
      );
      await actor(connection, "service_role", fixture.user);
      await expectSqlError(
        connection,
        submissionSql(true),
        [
          fixture.user,
          fixture.document,
          randomUUID(),
          fixture.category,
          digest(),
          revisedPath,
        ],
        "42501",
        "EMAIL_VERIFICATION_REQUIRED",
      );
      expect(
        (
          await connection.query(
            "select current_version_no, current_status from public.documents where id = $1",
            [fixture.document],
          )
        ).rows,
      ).toEqual([
        { current_version_no: 1, current_status: "revision_requested" },
      ]);
      expect(
        (
          await connection.query(
            "select id from public.document_submissions where document_id = $1",
            [fixture.document],
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await connection.query(
            "select action from public.audit_logs where resource_id = $1",
            [fixture.document],
          )
        ).rows,
      ).toEqual([{ action: "document.submitted" }]);
    });
  });
});
