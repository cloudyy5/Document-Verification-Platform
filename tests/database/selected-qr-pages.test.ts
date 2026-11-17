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

const layoutVersion = "selected-pages-draggable-web-evidence-v3";
const mark = (page = 5) => ({
  page,
  x: 0.1,
  y: 0.2,
  widthPt: 600,
  heightPt: 800,
  rotation: 0,
  userUnit: 1,
});
type F = Awaited<ReturnType<typeof fixture>>;
const approveSQL =
  "select public.approve_signing_request_with_selected_pages($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) as data";
function args(
  f: F,
  plan: unknown = [mark()],
  count: number | null = 5,
): unknown[] {
  return [
    f.b,
    f.request,
    randomUUID(),
    f.version,
    hash,
    policy,
    true,
    true,
    "b".repeat(64),
    JSON.stringify(plan),
    count,
  ];
}
async function approve(c: PoolClient, f: F, values = args(f)) {
  await role(c, "service_role");
  return (await c.query(approveSQL, values)).rows[0].data;
}
describe("selected QR pages v3 and historical version compatibility", () => {
  it("rejects the read-only preflight null actor before any input or mutation", () =>
    tx(async (c) => {
      await role(c, "service_role");
      await denied(c, approveSQL, Array(11).fill(null));
    }));
  it("serializes competing approvals and owner cancellation without duplicate receipts", async () => {
    async function race(sql: string, values: unknown[]) {
      const c = await pool.connect();
      try {
        await c.query("begin");
        await role(c, "service_role");
        const result = await c.query(sql, values);
        await c.query("commit");
        return result;
      } catch (error) {
        await c.query("rollback");
        throw error;
      } finally {
        c.release();
      }
    }
    for (const cancellation of [false, true]) {
      const c = await pool.connect();
      let f: F;
      try {
        await c.query("begin");
        f = await fixture(c);
        await c.query("commit");
      } finally {
        c.release();
      }
      const first = args(f),
        second = args(f, [mark(2), mark(5)]);
      const outcomes = await Promise.allSettled([
        race(approveSQL, first),
        cancellation
          ? race("select public.cancel_signing_request($1,$2)", [
              f.a,
              f.request,
            ])
          : race(approveSQL, second),
      ]);
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const record = (
        await pool.query(
          "select status,(select count(*)::int from public.signing_receipts where request_id=r.id) as receipts from public.signing_requests r where id=$1",
          [f.request],
        )
      ).rows[0];
      expect(record.receipts).toBe(record.status === "consented" ? 1 : 0);
      expect(
        cancellation ? ["consented", "cancelled"] : ["consented"],
      ).toContain(record.status);
    }
  });
  it("records only the selected page while retaining the full source page count", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f);
      await role(c, "postgres");
      const row = (
        await c.query(
          "select layout_version,source_page_count,placement_plan,plan_sha256=encode(extensions.digest(placement_plan::text,'sha256'),'hex') as valid from public.signing_receipt_layouts where receipt_id=$1",
          [receipt.receiptId],
        )
      ).rows[0];
      expect(row).toEqual({
        layout_version: layoutVersion,
        source_page_count: 5,
        placement_plan: [mark()],
        valid: true,
      });
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status,
      ).toBe("consented");
    }));
  it("supports two nonconsecutive pages and all-page selection", () =>
    tx(async (c) => {
      for (const plan of [[mark(2), mark(5)], [1, 2, 3, 4, 5].map(mark)]) {
        const f = await fixture(c);
        expect((await approve(c, f, args(f, plan))).action).toBe("approve");
      }
    }));
  it.each([
    { plan: [], count: 5 },
    { plan: null, count: 5 },
    { plan: [mark(0)], count: 5 },
    { plan: [mark(6)], count: 5 },
    { plan: [mark(1.5)], count: 5 },
    { plan: [mark(2), mark(2)], count: 5 },
    { plan: [mark(5), mark(2)], count: 5 },
    { plan: [mark()], count: null },
    { plan: [mark()], count: 0 },
    { plan: [mark()], count: 2001 },
    { plan: [{ ...mark(), x: 0.99 }], count: 5 },
    { plan: [{ ...mark(), widthPt: 0 }], count: 5 },
    { plan: [{ ...mark(), rotation: 45 }], count: 5 },
    { plan: [{ ...mark(), owner_id: "injected" }], count: 5 },
  ])("rejects invalid selection atomically (%j)", ({ plan, count }) =>
    tx(async (c) => {
      const f = await fixture(c);
      await denied(c, approveSQL, args(f, plan, count), "22023");
      expect(
        (
          await c.query(
            "select count(*)::int n from public.signing_decisions where request_id=$1",
            [f.request],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status,
      ).toBe("pending");
    }),
  );
  it("allows exact retry but rejects changed QR quantity, location, source count, key and layout version", () =>
    tx(async (c) => {
      const f = await fixture(c),
        values = args(f),
        receipt = await approve(c, f, values);
      expect(await approve(c, f, values)).toEqual(receipt);
      for (const change of [
        { index: 9, value: JSON.stringify([mark(1), mark(5)]) },
        { index: 9, value: JSON.stringify([{ ...mark(), x: 0.3 }]) },
        { index: 10, value: 6 },
        { index: 2, value: randomUUID() },
      ]) {
        const changed = [...values];
        changed[change.index] = change.value;
        await denied(c, approveSQL, changed, "P0001");
      }
      const other = await fixture(c),
        old = args(other, [mark(1)], 1);
      const oldSQL =
        "select public.approve_signing_request_with_placement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as data";
      await c.query(oldSQL, old.slice(0, 10));
      await denied(c, approveSQL, old, "P0001");
      const newer = await fixture(c),
        nv = args(newer, [mark(1)], 1);
      await approve(c, newer, nv);
      await denied(c, oldSQL, nv.slice(0, 10), "P0001");
    }));
  it("denies public/authenticated writes, unverified actors and nonrecipients", () =>
    tx(async (c) => {
      const f = await fixture(c);
      await role(c, "anon");
      await denied(c, approveSQL, args(f));
      await role(c, "authenticated", f.b);
      await denied(c, approveSQL, args(f));
      await denied(
        c,
        "insert into public.signing_receipt_layouts(receipt_id,placement_plan,plan_sha256) values('fake','[]','fake')",
      );
      await role(c, "service_role");
      for (const actor of [f.a, f.other]) {
        const v = args(f);
        v[0] = actor;
        await denied(c, approveSQL, v, "P0002");
      }
      await role(c, "postgres");
      await c.query(
        "update auth.users set email_confirmed_at=null where id=$1",
        [f.b],
      );
      await role(c, "service_role");
      await denied(c, approveSQL, args(f));
    }));
  it("keeps layout reads participant-only and immutable even for an operator", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f);
      for (const actor of [f.a, f.b, f.other]) {
        await role(c, "authenticated", actor);
        expect(
          (
            await c.query(
              "select * from public.signing_receipt_layouts where receipt_id=$1",
              [receipt.receiptId],
            )
          ).rowCount,
        ).toBe(actor === f.other ? 0 : 1);
      }
      await role(c, "postgres");
      await c.query(
        "insert into public.user_roles(user_id,role) values($1,'platform_admin')",
        [f.other],
      );
      await role(c, "authenticated", f.other);
      expect(
        (
          await c.query(
            "select * from public.signing_receipt_layouts where receipt_id=$1",
            [receipt.receiptId],
          )
        ).rowCount,
      ).toBe(0);
      await role(c, "postgres");
      await denied(
        c,
        "update public.signing_receipt_layouts set source_page_count=6 where receipt_id=$1",
        [receipt.receiptId],
        "P0001",
      );
      await denied(
        c,
        "delete from public.signing_receipt_layouts where receipt_id=$1",
        [receipt.receiptId],
        "P0001",
      );
    }));
  it("finalizes five pages with one QR and refuses a truncated or extra-page result", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f);
      const claim = (
        await c.query("select public.claim_signing_render($1,$2) as data", [
          f.b,
          receipt.receiptId,
        ])
      ).rows[0].data;
      const path = `${f.a}/signing-results/${receipt.receiptId}/${claim.claimToken}.pdf`;
      await role(c, "postgres");
      await c.query(
        "insert into storage.objects(bucket_id,name) values('signing-results',$1)",
        [path],
      );
      await role(c, "service_role");
      const sql =
        "select public.complete_signing_render($1,$2,$3,$4,$5,$6,$7) as ok";
      const v = [
        f.b,
        receipt.receiptId,
        claim.claimToken,
        path,
        5000,
        "c".repeat(64),
        5,
      ];
      for (const count of [1, 4, 6])
        await denied(c, sql, [...v.slice(0, 6), count], "22023");
      expect((await c.query(sql, v)).rows[0].ok).toBe(true);
      expect((await c.query(sql, v)).rows[0].ok).toBe(true);
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status,
      ).toBe("completed");
    }));
  it("refuses approval after cancellation or source hash mismatch", () =>
    tx(async (c) => {
      const f = await fixture(c),
        bad = args(f);
      bad[4] = "f".repeat(64);
      await denied(c, approveSQL, bad, "P0001");
      await c.query("select public.cancel_signing_request($1,$2)", [
        f.a,
        f.request,
      ]);
      await denied(c, approveSQL, args(f), "P0001");
    }));
});
