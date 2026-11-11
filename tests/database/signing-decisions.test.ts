import { randomUUID, randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  process.env.DVP_DATABASE_TEST_ISOLATED !== "1" ||
  new URL(url).hostname !== "127.0.0.1"
)
  throw new Error("Use the isolated database runner.");
const pool = new Pool({
  connectionString: url,
  max: 4,
  statement_timeout: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
});
const hash = "a".repeat(64),
  policy = "internal-action-development-2026-11-05";
async function role(
  c: PoolClient,
  value: "postgres" | "service_role" | "authenticated" | "anon",
  actor?: string,
) {
  await c.query(`set local role ${value}`);
  await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
    actor ?? "",
  ]);
  await c.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify(actor ? { sub: actor, role: value } : { role: value }),
  ]);
}
async function tx(run: (c: PoolClient) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await run(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}
async function fixture(c: PoolClient) {
  await role(c, "postgres");
  const a = randomUUID(),
    b = randomUUID(),
    other = randomUUID(),
    doc = randomUUID(),
    version = randomUUID(),
    request = randomUUID();
  for (const id of [a, b, other])
    await c.query(
      'insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values($1,\'{"full_name":"Synthetic R3"}\',now())',
      [id],
    );
  const category = (
    await c.query(
      "select id from public.document_categories where slug='pendidikan'",
    )
  ).rows[0].id;
  const path = `${a}/signing/${doc}/${version}.pdf`;
  await c.query(
    "insert into storage.objects(bucket_id,name) values('document-submissions',$1)",
    [path],
  );
  const code = (
    await c.query(
      "select code from public.signing_user_identifiers where user_id=$1",
      [b],
    )
  ).rows[0].code;
  await role(c, "service_role");
  await c.query(
    "select public.create_signing_draft($1,$2,$3,'Synthetic R3',$4,null,null,null,null,'r3.pdf',2831,$5,$6,'internal-upload-development-2026-11-05',true)",
    [a, doc, version, category, hash, path],
  );
  await c.query(
    "select public.send_signing_request($1,$2,$3,$4,$5,'internal-sharing-development-2026-11-05',true)",
    [a, request, version, code, b],
  );
  return { a, b, other, doc, version, request };
}
type F = Awaited<ReturnType<typeof fixture>>;
function args(
  f: F,
  action = "approve",
  overrides: Record<number, unknown> = {},
) {
  const values: unknown[] = [
    f.b,
    f.request,
    randomUUID(),
    f.version,
    hash,
    action,
    action === "reject" ? "Informasi belum sesuai" : null,
    policy,
    action === "approve",
    true,
    randomBytes(32).toString("hex"),
  ];
  for (const [key, value] of Object.entries(overrides))
    values[Number(key)] = value;
  return values;
}
const decisionSQL =
  "select public.decide_signing_request($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as data";
async function decide(c: PoolClient, values: unknown[]) {
  await role(c, "service_role");
  return (await c.query(decisionSQL, values)).rows[0].data;
}
async function denied(
  c: PoolClient,
  sql: string,
  values: unknown[] = [],
  code = "42501",
) {
  await c.query("savepoint denial");
  let error: unknown;
  try {
    await c.query(sql, values);
  } catch (value) {
    error = value;
  } finally {
    await c.query("rollback to savepoint denial");
    await c.query("release savepoint denial");
  }
  expect(error).toBeInstanceOf(Error);
  expect((error as { code: string }).code).toBe(code);
}
afterAll(() => pool.end());
async function committedFixture() {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const f = await fixture(c);
    await c.query("commit");
    return f;
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}
async function concurrent(run: (c: PoolClient) => Promise<unknown>) {
  const c = await pool.connect();
  try {
    await c.query("begin");
    const result = await run(c);
    await c.query("commit");
    return { ok: true, result };
  } catch (error) {
    await c.query("rollback");
    return { ok: false, code: (error as { code: string }).code };
  } finally {
    c.release();
  }
}
describe("R3 immutable decisions and recoverable private artifacts", () => {
  it.each(["approve", "reject", "cancel"])(
    "serializes approve racing with %s into one final decision",
    async (competing) => {
      const f = await committedFixture();
      const results = await Promise.all([
        concurrent((c) => decide(c, args(f))),
        concurrent(async (c) => {
          await role(c, "service_role");
          return competing === "cancel"
            ? c.query("select public.cancel_signing_request($1,$2)", [
                f.a,
                f.request,
              ])
            : decide(c, args(f, competing));
        }),
      ]);
      expect(results.filter((result) => result.ok).length).toBe(1);
      expect(results.find((result) => !result.ok)?.code).toBe("P0001");
      const c = await pool.connect();
      try {
        const state = (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status;
        expect(
          [
            "consented",
            competing === "cancel" ? "cancelled" : "rejected",
          ].includes(state),
        ).toBe(true);
        const counts = (
          await c.query(
            "select (select count(*)::int from public.signing_decisions where request_id=$1) as decisions,(select count(*)::int from public.signing_receipts where request_id=$1) as receipts",
            [f.request],
          )
        ).rows[0];
        expect(counts.decisions).toBe(state === "cancelled" ? 0 : 1);
        expect(counts.receipts).toBe(state === "consented" ? 1 : 0);
      } finally {
        c.release();
      }
    },
  );
  it("commits one explicit approval, receipt and pending artifact; exact retry is idempotent", async () =>
    tx(async (c) => {
      const f = await fixture(c),
        input = args(f),
        first = await decide(c, input),
        second = await decide(c, input);
      expect(second).toEqual(first);
      expect(first.receiptId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status,
      ).toBe("consented");
      expect(
        (
          await c.query(
            "select state from public.signing_artifacts where receipt_id=$1",
            [first.receiptId],
          )
        ).rows[0].state,
      ).toBe("pending");
      await denied(c, decisionSQL, args(f, "reject"), "P0001");
      await role(c, "postgres");
      for (const [table, column, value] of [
        ["signing_decisions", "request_id", f.request],
        ["signing_receipts", "request_id", f.request],
        ["signing_artifacts", "receipt_id", first.receiptId],
      ])
        expect(
          (
            await c.query(
              `select count(*)::int as n from public.${table} where ${column}=$1`,
              [value],
            )
          ).rows[0].n,
        ).toBe(1);
      expect(
        (
          await c.query(
            "select count(*)::int as n from private.signing_audit_events where request_id=$1 and action='approved'",
            [f.request],
          )
        ).rows[0].n,
      ).toBe(1);
      await denied(
        c,
        "update public.signing_decisions set reason='modified' where request_id=$1",
        [f.request],
        "P0001",
      );
      await denied(
        c,
        "delete from public.signing_receipts where id=$1",
        [first.receiptId],
        "P0001",
      );
    }));
  it("requires a rejection reason, issues no receipt, revokes source and keeps minimal private history", async () =>
    tx(async (c) => {
      const f = await fixture(c);
      await denied(c, decisionSQL, args(f, "reject", { 6: " " }), "22023");
      await denied(
        c,
        decisionSQL,
        args(f, "reject", { 6: "x".repeat(1001) }),
        "22023",
      );
      const result = await decide(c, args(f, "reject"));
      expect(result.receiptId).toBeNull();
      await role(c, "authenticated", f.b);
      expect(
        (
          await c.query(
            "select id from public.signing_document_versions where id=$1",
            [f.version],
          )
        ).rowCount,
      ).toBe(0);
      const row = (
        await c.query(
          "select reason from public.signing_decisions where request_id=$1",
          [f.request],
        )
      ).rows[0];
      expect(row.reason).toBe("Informasi belum sesuai");
      expect(
        (
          await c.query(
            "select id from public.signing_receipts where request_id=$1",
            [f.request],
          )
        ).rowCount,
      ).toBe(0);
      await role(c, "authenticated", f.other);
      expect(
        (
          await c.query(
            "select id from public.signing_decisions where request_id=$1",
            [f.request],
          )
        ).rowCount,
      ).toBe(0);
      await role(c, "authenticated", f.a);
      expect(
        (
          await c.query(
            "select id from public.signing_document_versions where id=$1",
            [f.version],
          )
        ).rowCount,
      ).toBe(1);
    }));
  it.each([
    ["owner", 0, "owner", "P0002"],
    ["outsider", 0, "other", "P0002"],
    ["version", 3, "uuid", "P0001"],
    ["source hash", 4, "hash", "P0001"],
    ["consent", 8, false, "22023"],
    ["confirmation", 9, false, "22023"],
    ["policy", 7, "old-policy", "22023"],
    ["binding", 10, "invalid", "22023"],
  ])(
    "rejects invalid %s before creating evidence",
    async (_name, index, value, code) =>
      tx(async (c) => {
        const f = await fixture(c);
        const replacement =
          value === "owner"
            ? f.a
            : value === "other"
              ? f.other
              : value === "uuid"
                ? randomUUID()
                : value === "hash"
                  ? "f".repeat(64)
                  : value;
        await denied(
          c,
          decisionSQL,
          args(f, "approve", { [Number(index)]: replacement }),
          String(code),
        );
        expect(
          (
            await c.query(
              "select id from public.signing_decisions where request_id=$1",
              [f.request],
            )
          ).rowCount,
        ).toBe(0);
      }),
  );
  it("denies direct API mutations and uninvolved administrator reads", async () =>
    tx(async (c) => {
      const f = await fixture(c),
        result = await decide(c, args(f));
      await role(c, "postgres");
      await c.query(
        "insert into public.user_roles(user_id,role) values($1,'platform_admin')",
        [f.other],
      );
      for (const value of ["anon", "authenticated"] as const) {
        await role(c, value, f.other);
        await denied(c, decisionSQL, args(f));
      }
      await role(c, "authenticated", f.other);
      expect(
        (
          await c.query("select id from public.signing_receipts where id=$1", [
            result.receiptId,
          ])
        ).rowCount,
      ).toBe(0);
      await role(c, "service_role");
      await denied(
        c,
        "update public.signing_artifacts set state='ready' where receipt_id=$1",
        [result.receiptId],
      );
      await denied(c, "select * from private.signing_render_jobs");
    }));
  it("serializes render claims and retries without replacing the decision; only a matching stored result completes", async () =>
    tx(async (c) => {
      const f = await fixture(c),
        approved = await decide(c, args(f));
      const claim = (
        await c.query("select public.claim_signing_render($1,$2) as data", [
          f.a,
          approved.receiptId,
        ])
      ).rows[0].data;
      expect(claim.claimToken).toMatch(/^[0-9a-f-]{36}$/);
      const busy = (
        await c.query("select public.claim_signing_render($1,$2) as data", [
          f.b,
          approved.receiptId,
        ])
      ).rows[0].data;
      expect(busy.claimToken).toBeUndefined();
      expect(
        (
          await c.query(
            "select public.fail_signing_render($1,$2,$3,'RENDER_FAILED') as ok",
            [f.a, approved.receiptId, claim.claimToken],
          )
        ).rows[0].ok,
      ).toBe(true);
      const retry = (
        await c.query("select public.claim_signing_render($1,$2) as data", [
          f.b,
          approved.receiptId,
        ])
      ).rows[0].data;
      expect(retry.claimToken).not.toBe(claim.claimToken);
      const path = `${f.a}/signing-results/${approved.receiptId}/${retry.claimToken}.pdf`;
      const finish =
        "select public.complete_signing_render($1,$2,$3,$4,4096,$5,2) as ok";
      await denied(
        c,
        finish,
        [f.a, approved.receiptId, claim.claimToken, path, hash],
        "22023",
      );
      await role(c, "postgres");
      await c.query(
        "insert into storage.objects(bucket_id,name) values('signing-results',$1)",
        [path],
      );
      await role(c, "service_role");
      expect(
        (
          await c.query(finish, [
            f.b,
            approved.receiptId,
            retry.claimToken,
            path,
            hash,
          ])
        ).rows[0].ok,
      ).toBe(true);
      expect(
        (
          await c.query(finish, [
            f.b,
            approved.receiptId,
            retry.claimToken,
            path,
            hash,
          ])
        ).rows[0].ok,
      ).toBe(true);
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status,
      ).toBe("completed");
      await role(c, "postgres");
      await denied(
        c,
        "update public.signing_artifacts set artifact_sha256=$1 where receipt_id=$2",
        ["b".repeat(64), approved.receiptId],
        "P0001",
      );
    }));
  it("rejects a decision racing after cancellation and keeps expiry closed", async () =>
    tx(async (c) => {
      const f = await fixture(c);
      await c.query("select public.cancel_signing_request($1,$2)", [
        f.a,
        f.request,
      ]);
      await denied(c, decisionSQL, args(f), "P0001");
      const other = await fixture(c);
      await role(c, "postgres");
      await c.query(
        "alter table public.signing_requests disable trigger signing_requests_history_guard",
      );
      await c.query(
        "update public.signing_requests set sent_at=now()-interval '8 days',expires_at=now()-interval '8 days'+interval '168 hours',sharing_consented_at=now()-interval '8 days' where id=$1",
        [other.request],
      );
      await c.query(
        "alter table public.signing_requests enable trigger signing_requests_history_guard",
      );
      await role(c, "service_role");
      await denied(c, decisionSQL, args(other), "P0001");
    }));
  it("validates limiter input before writes and limits actor/global attempts atomically", async () =>
    tx(async (c) => {
      await role(c, "service_role");
      await denied(
        c,
        "select public.consume_signing_r3_limit('invalid','bad','bad')",
        [],
        "22023",
      );
      const a = randomBytes(32).toString("hex"),
        global = randomBytes(32).toString("hex");
      for (let i = 0; i < 10; i++)
        expect(
          (
            await c.query(
              "select public.consume_signing_r3_limit('decision',$1,$2) as ok",
              [a, global],
            )
          ).rows[0].ok,
        ).toBe(true);
      expect(
        (
          await c.query(
            "select public.consume_signing_r3_limit('decision',$1,$2) as ok",
            [a, global],
          )
        ).rows[0].ok,
      ).toBe(false);
    }));
});
