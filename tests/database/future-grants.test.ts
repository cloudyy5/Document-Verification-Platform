import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_TEST_URL;
if (!databaseUrl || process.env.DVP_DATABASE_TEST_ISOLATED !== "1") {
  throw new Error(
    "Run database checks through npm run test:db against its isolated cluster.",
  );
}
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/postgres") {
  throw new Error(
    "Database tests may target only the isolated loopback cluster.",
  );
}

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});

beforeAll(async () => {
  await client.connect();
});
afterAll(async () => {
  await client.end();
});

describe("future public objects require explicit API grants", () => {
  it.each(["anon", "authenticated", "service_role"])(
    "%s receives no automatic table, identity sequence, or function privileges",
    async (role) => {
      await client.query("begin");
      try {
        await client.query(`
          create table public.dvp_test_future_grants (
            id bigint generated always as identity primary key,
            payload text
          );
          create function public.dvp_test_future_function()
          returns integer language sql immutable set search_path = ''
          as 'select 1';
        `);
        const ownerUse = await client.query<{ id: string }>(
          "insert into public.dvp_test_future_grants (payload) values ('test-only') returning id",
        );
        expect(ownerUse.rows).toHaveLength(1);

        const rights = await client.query<{
          table_privilege: boolean;
          sequence_privilege: boolean;
          function_privilege: boolean;
        }>(
          `select
            has_table_privilege($1, 'public.dvp_test_future_grants',
              'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') as table_privilege,
            has_sequence_privilege($1, 'public.dvp_test_future_grants_id_seq',
              'USAGE, SELECT, UPDATE') as sequence_privilege,
            has_function_privilege($1, 'public.dvp_test_future_function()',
              'EXECUTE') as function_privilege`,
          [role],
        );
        expect(rights.rows[0]).toEqual({
          table_privilege: false,
          sequence_privilege: false,
          function_privilege: false,
        });
      } finally {
        await client.query("rollback");
      }
    },
  );

  it("preserves explicit service-only approval and authenticated RLS helper grants", async () => {
    const approvalSignature =
      "public.apply_review_decision(uuid,uuid,public.review_decision_type,jsonb,text,uuid,text,smallint)";
    for (const role of ["anon", "authenticated", "service_role"]) {
      const result = await client.query<{ allowed: boolean }>(
        "select has_function_privilege($1, $2, 'EXECUTE') as allowed",
        [role, approvalSignature],
      );
      expect(result.rows[0]?.allowed, role).toBe(role === "service_role");
    }
    const helper = await client.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated', 'private.can_read_review_document(uuid)', 'EXECUTE') as allowed",
    );
    expect(helper.rows[0]?.allowed).toBe(true);
  });
});
