import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_TEST_URL;
if (!databaseUrl || process.env.DVP_DATABASE_TEST_ISOLATED !== "1")
  throw new Error("Run upload limiter tests through npm run test:db.");
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/postgres")
  throw new Error(
    "Upload limiter SQL tests require the isolated loopback cluster.",
  );
const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  allowExitOnIdle: true,
});
const digest = () => randomBytes(32).toString("hex");
async function actor(
  connection: PoolClient,
  role: "postgres" | "anon" | "authenticated" | "service_role",
) {
  await connection.query(`set local role ${role}`);
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
async function consume(connection: PoolClient, key: string, global: string) {
  return (
    await connection.query<{ allowed: boolean }>(
      "select public.consume_document_upload_limit($1, $2) as allowed",
      [key, global],
    )
  ).rows[0]!.allowed;
}
async function denied(
  connection: PoolClient,
  key: string | null,
  global: string | null,
  state: string,
) {
  await connection.query("savepoint upload_limit_denied");
  let failure: unknown;
  try {
    await connection.query(
      "select public.consume_document_upload_limit($1, $2)",
      [key, global],
    );
  } catch (error) {
    failure = error;
  } finally {
    await connection.query("rollback to savepoint upload_limit_denied");
    await connection.query("release savepoint upload_limit_denied");
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as { code?: string }).code).toBe(state);
}
afterAll(async () => {
  await pool.end();
});

describe("combined persistent document upload backstop", () => {
  it("caps a user's attempts at ten and does not spend global capacity for denied repeats", async () => {
    await transaction(async (connection) => {
      const key = digest();
      const global = digest();
      await actor(connection, "service_role");
      for (let index = 0; index < 10; index++)
        expect(await consume(connection, key, global)).toBe(true);
      for (let index = 0; index < 5; index++)
        expect(await consume(connection, key, global)).toBe(false);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select action, hits from private.auth_rate_limits where key_digest in ($1,$2) order by action",
            [key, global],
          )
        ).rows,
      ).toEqual([
        { action: "upload", hits: 10 },
        { action: "upload_global", hits: 10 },
      ]);
    });
  });

  it("caps the global window at fifty without creating keys for additional identities", async () => {
    await transaction(async (connection) => {
      const global = digest();
      const deniedKeys = Array.from({ length: 15 }, digest);
      await actor(connection, "service_role");
      for (let index = 0; index < 50; index++)
        expect(await consume(connection, digest(), global)).toBe(true);
      for (const key of deniedKeys)
        expect(await consume(connection, key, global)).toBe(false);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select hits from private.auth_rate_limits where action='upload_global' and key_digest=$1",
            [global],
          )
        ).rows,
      ).toEqual([{ hits: 50 }]);
      expect(
        (
          await connection.query(
            "select key_digest from private.auth_rate_limits where action='upload' and key_digest=any($1::text[])",
            [deniedKeys],
          )
        ).rows,
      ).toEqual([]);
    });
  });

  it("renews expired windows together and cleans only stale upload counters", async () => {
    await transaction(async (connection) => {
      const key = digest();
      const global = digest();
      const stale = digest();
      const oldAuth = digest();
      await connection.query(
        "insert into private.auth_rate_limits values ('upload',$1,10,now()-interval '16 minutes'),('upload_global',$2,50,now()-interval '16 minutes'),('upload',$3,1,now()-interval '2 days'),('login',$4,1,now()-interval '2 days')",
        [key, global, stale, oldAuth],
      );
      await actor(connection, "service_role");
      expect(await consume(connection, key, global)).toBe(true);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select hits from private.auth_rate_limits where key_digest in ($1,$2)",
            [key, global],
          )
        ).rows,
      ).toEqual([{ hits: 1 }, { hits: 1 }]);
      expect(
        (
          await connection.query(
            "select key_digest from private.auth_rate_limits where key_digest=$1",
            [stale],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await connection.query(
            "select key_digest from private.auth_rate_limits where key_digest=$1",
            [oldAuth],
          )
        ).rowCount,
      ).toBe(1);
    });
  });

  it.each(["anon", "authenticated"] as const)(
    "denies %s direct execution even with valid digests",
    async (role) => {
      await transaction(async (connection) => {
        await actor(connection, role);
        await denied(connection, digest(), digest(), "42501");
      });
    },
  );

  it.each([
    [null, "a".repeat(64)],
    ["a".repeat(64), null],
    ["raw-user-id", "a".repeat(64)],
    ["a".repeat(64), "A".repeat(64)],
    ["a".repeat(63), "a".repeat(64)],
  ])("rejects malformed digest input %j / %j", async (key, global) => {
    await transaction(async (connection) => {
      await actor(connection, "service_role");
      await denied(connection, key, global, "22023");
    });
  });

  it.each([
    [16, false, 10],
    [60, true, 50],
  ] as const)(
    "enforces atomic bounds across %i committed concurrent requests",
    async (attempts, distinctUsers, expected) => {
      const global = digest();
      const sharedUser = digest();
      const userKeys = Array.from({ length: attempts }, () =>
        distinctUsers ? digest() : sharedUser,
      );
      try {
        const results = await Promise.allSettled(
          userKeys.map(async (key) => {
            const connection = await pool.connect();
            try {
              await connection.query("begin");
              await actor(connection, "service_role");
              const allowed = await consume(connection, key, global);
              await connection.query("commit");
              return allowed;
            } finally {
              await connection.query("rollback");
              connection.release();
            }
          }),
        );
        expect(results.every((result) => result.status === "fulfilled")).toBe(
          true,
        );
        expect(
          results.filter(
            (result) => result.status === "fulfilled" && result.value,
          ),
        ).toHaveLength(expected);
        expect(
          (
            await pool.query(
              "select hits from private.auth_rate_limits where action='upload_global' and key_digest=$1",
              [global],
            )
          ).rows,
        ).toEqual([{ hits: expected }]);
        if (distinctUsers)
          expect(
            (
              await pool.query(
                "select key_digest from private.auth_rate_limits where action='upload' and key_digest=any($1::text[])",
                [userKeys],
              )
            ).rowCount,
          ).toBe(50);
      } finally {
        await pool.query(
          "delete from private.auth_rate_limits where (action='upload_global' and key_digest=$1) or (action='upload' and key_digest=any($2::text[]))",
          [global, userKeys],
        );
      }
    },
  );
});
