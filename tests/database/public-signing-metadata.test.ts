import { randomUUID } from "node:crypto";
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

type F = Awaited<ReturnType<typeof fixture>>;
async function approve(c: PoolClient, f: F, version: "v1" | "v2" | "v3") {
  const args = [
    f.b,
    f.request,
    randomUUID(),
    f.version,
    hash,
    policy,
    true,
    true,
    "b".repeat(64),
  ];
  const plan = JSON.stringify([
    {
      page: version === "v3" ? 5 : 1,
      x: 0.1,
      y: 0.2,
      widthPt: 600,
      heightPt: 800,
      rotation: 0,
      userUnit: 1,
    },
  ]);
  const sql =
    version === "v1"
      ? "select public.decide_signing_request($1,$2,$3,$4,$5,'approve',null,$6,$7,$8,$9) as data"
      : version === "v2"
        ? "select public.approve_signing_request_with_placement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as data"
        : "select public.approve_signing_request_with_selected_pages($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,5) as data";
  return (await c.query(sql, version === "v1" ? args : [...args, plan])).rows[0]
    .data;
}
const readSQL = "select public.get_signing_public_metadata($1) as data";
describe("S-19 public metadata projection with unchanged private grants", () => {
  it.each(["v1", "v2", "v3"] as const)(
    "returns only approved metadata for %s historical/new evidence",
    (version) =>
      tx(async (c) => {
        const f = await fixture(c),
          receipt = await approve(c, f, version);
        const data = (await c.query(readSQL, [receipt.receiptId])).rows[0].data;
        expect(Object.keys(data).sort()).toEqual([
          "approvedAt",
          "documentTitle",
          "signerName",
          "status",
        ]);
        expect(data).toMatchObject({
          status: "approved",
          documentTitle: "Synthetic R3",
          signerName: "Synthetic R3",
          approvedAt: receipt.decidedAt,
        });
        expect(JSON.stringify(data)).not.toMatch(
          /DVP-|storage|sha256|email|owner_id|recipient_id|source_version_id|receiptId|pdf/i,
        );
      }),
  );
  it.each([
    null,
    "",
    "R".repeat(42),
    "R".repeat(44),
    "Z".repeat(43),
    "../details",
  ])("returns no metadata for unknown/invalid token %j", (id) =>
    tx(async (c) => {
      await role(c, "service_role");
      expect((await c.query(readSQL, [id])).rows[0].data).toBeNull();
    }),
  );
  it("keeps raw metadata tables and the projection RPC inaccessible to anon/authenticated visitors", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f, "v3");
      await role(c, "anon");
      await denied(c, readSQL, [receipt.receiptId]);
      await denied(c, "select * from public.signing_receipts");
      expect(
        (
          await c.query(
            "select * from storage.objects where bucket_id='signing-results'",
          )
        ).rowCount,
      ).toBe(0);
      await role(c, "authenticated", f.other);
      await denied(c, readSQL, [receipt.receiptId]);
      expect(
        (
          await c.query("select * from public.signing_receipts where id=$1", [
            receipt.receiptId,
          ])
        ).rowCount,
      ).toBe(0);
    }));
  it("does not turn pending, cancelled or rejected requests into evidence", () =>
    tx(async (c) => {
      for (const action of ["pending", "cancel", "reject"]) {
        const f = await fixture(c);
        if (action === "cancel")
          await c.query("select public.cancel_signing_request($1,$2)", [
            f.a,
            f.request,
          ]);
        if (action === "reject")
          await c.query(
            "select public.decide_signing_request($1,$2,$3,$4,$5,'reject','Synthetic rejection',$6,false,true,$7)",
            [
              f.b,
              f.request,
              randomUUID(),
              f.version,
              hash,
              policy,
              "b".repeat(64),
            ],
          );
        expect(
          (
            await c.query(
              "select count(*)::int n from public.signing_receipts where request_id=$1",
              [f.request],
            )
          ).rows[0].n,
        ).toBe(0);
        expect((await c.query(readSQL, [f.request])).rows[0].data).toBeNull();
      }
    }));
  it("reads immutable signer/title snapshots and does not alter evidence or source history", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f, "v2");
      const before = (await c.query(readSQL, [receipt.receiptId])).rows[0].data;
      await role(c, "postgres");
      await c.query(
        "update public.profiles set full_name='Changed synthetic profile' where id=$1",
        [f.b],
      );
      await role(c, "service_role");
      expect(
        (await c.query(readSQL, [receipt.receiptId])).rows[0].data,
      ).toEqual(before);
      expect(
        (
          await c.query(
            "select count(*)::int n from public.signing_decisions where request_id=$1",
            [f.request],
          )
        ).rows[0].n,
      ).toBe(1);
      await role(c, "postgres");
      await denied(
        c,
        "update public.signing_receipts set signer_name='replacement' where id=$1",
        [receipt.receiptId],
        "P0001",
      );
    }));
  it("persists the per-receipt limiter across calls, resets its window and bounds rejected hits", () =>
    tx(async (c) => {
      await role(c, "service_role");
      const sql =
          "select public.consume_public_signing_metadata_limit($1,$2) as allowed",
        values = ["a".repeat(64), "b".repeat(64)];
      for (let i = 0; i < 60; i++)
        expect((await c.query(sql, values)).rows[0].allowed).toBe(true);
      for (let i = 0; i < 3; i++)
        expect((await c.query(sql, values)).rows[0].allowed).toBe(false);
      await role(c, "postgres");
      expect(
        (
          await c.query(
            "select hits from private.public_signing_metadata_limits where scope='receipt' and key_digest=$1",
            [values[0]],
          )
        ).rows[0].hits,
      ).toBe(61);
      await c.query(
        "update private.public_signing_metadata_limits set window_started_at=clock_timestamp()-interval '6 minutes'",
      );
      await role(c, "service_role");
      expect((await c.query(sql, values)).rows[0].allowed).toBe(true);
    }));
  it("enforces the global limit even when a visitor rotates QR identifiers", () =>
    tx(async (c) => {
      await role(c, "postgres");
      await c.query(
        "insert into private.public_signing_metadata_limits(scope,key_digest,hits,window_started_at) values('global',$1,1000,clock_timestamp())",
        ["b".repeat(64)],
      );
      await role(c, "service_role");
      expect(
        (
          await c.query(
            "select public.consume_public_signing_metadata_limit($1,$2) as allowed",
            ["c".repeat(64), "b".repeat(64)],
          )
        ).rows[0].allowed,
      ).toBe(false);
      await role(c, "postgres");
      expect(
        (
          await c.query(
            "select count(*)::int n from private.public_signing_metadata_limits where scope='receipt'",
          )
        ).rows[0].n,
      ).toBe(0);
    }));
  it("validates limiter input before writes and grants only service execution", () =>
    tx(async (c) => {
      const sql = "select public.consume_public_signing_metadata_limit($1,$2)";
      await role(c, "service_role");
      await denied(c, sql, [null, null], "22023");
      await role(c, "postgres");
      expect(
        (
          await c.query(
            "select count(*)::int n from private.public_signing_metadata_limits",
          )
        ).rows[0].n,
      ).toBe(0);
      await role(c, "anon");
      await denied(c, sql, ["a".repeat(64), "b".repeat(64)]);
      await role(c, "authenticated");
      await denied(c, sql, ["a".repeat(64), "b".repeat(64)]);
      await denied(c, "select * from private.public_signing_metadata_limits");
    }));
});
