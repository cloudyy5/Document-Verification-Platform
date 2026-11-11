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

const modern = "per-page-draggable-web-evidence-v2";
const plan = () => [
  {
    page: 1,
    x: 0.1,
    y: 0.2,
    widthPt: 600,
    heightPt: 800,
    rotation: 0,
    userUnit: 1,
  },
];
type F = Awaited<ReturnType<typeof fixture>>;
function args(f: F, placement: unknown = plan()): unknown[] {
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
    JSON.stringify(placement),
  ];
}
const approveSQL =
  "select public.approve_signing_request_with_placement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) as data";
async function persistentFixture() {
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
async function racing(sql: string, values: unknown[]) {
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
async function approve(c: PoolClient, f: F, values = args(f)) {
  await role(c, "service_role");
  return (await c.query(approveSQL, values)).rows[0].data;
}
describe("R3b immutable recipient placement and source-page-only finalization", () => {
  it("serializes placement approval against owner cancellation", async () => {
    const f = await persistentFixture();
    const values = args(f);
    const outcomes = await Promise.allSettled([
      racing(approveSQL, values),
      racing("select public.cancel_signing_request($1,$2)", [f.a, f.request]),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    const state = (
      await pool.query(
        "select status from public.signing_requests where id=$1",
        [f.request],
      )
    ).rows[0].status;
    expect(["consented", "cancelled"]).toContain(state);
    const count = (
      await pool.query(
        "select count(*)::int as n from public.signing_receipts where request_id=$1",
        [f.request],
      )
    ).rows[0].n;
    expect(count).toBe(state === "consented" ? 1 : 0);
  });
  it("commits only one of two competing placement approvals", async () => {
    const f = await persistentFixture(),
      one = args(f),
      two = args(f, [{ ...plan()[0], x: 0.3 }]);
    const outcomes = await Promise.allSettled([
      racing(approveSQL, one),
      racing(approveSQL, two),
    ]);
    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(
      (
        await pool.query(
          "select count(*)::int as n from public.signing_receipts where request_id=$1",
          [f.request],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it("grants only scoped SELECT and service-only approval", () =>
    tx(async (c) => {
      const f = await fixture(c);
      await role(c, "anon");
      await denied(c, "select * from public.signing_receipt_layouts");
      await denied(c, approveSQL, args(f));
      await role(c, "authenticated", f.b);
      await denied(c, approveSQL, args(f));
      await denied(
        c,
        "insert into public.signing_receipt_layouts(receipt_id,placement_plan,plan_sha256) values('fake','[]','fake')",
      );
    }));
  it("creates exactly one approval, receipt and immutable hashed plan atomically", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f);
      expect(receipt.action).toBe("approve");
      expect(receipt.receiptId).toMatch(/^[A-Za-z0-9_-]{43}$/);
      await role(c, "postgres");
      const row = (
        await c.query(
          "select r.layout_version,l.placement_plan,l.plan_sha256=encode(extensions.digest(l.placement_plan::text,'sha256'),'hex') as valid from public.signing_receipts r join public.signing_receipt_layouts l on l.receipt_id=r.id where r.id=$1",
          [receipt.receiptId],
        )
      ).rows[0];
      expect(row).toEqual({
        layout_version: modern,
        placement_plan: plan(),
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
  it("replays an identical placement but rejects changes to location or decision key", () =>
    tx(async (c) => {
      const f = await fixture(c),
        values = args(f),
        receipt = await approve(c, f, values);
      expect(await approve(c, f, values)).toEqual(receipt);
      const moved = [...values];
      moved[9] = JSON.stringify([{ ...plan()[0], x: 0.3 }]);
      await denied(c, approveSQL, moved, "P0001");
      await denied(c, approveSQL, args(f), "P0001");
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.signing_decisions where request_id=$1",
            [f.request],
          )
        ).rows[0].n,
      ).toBe(1);
    }));
  it.each([
    null,
    [],
    [{ ...plan()[0], page: 2 }],
    [{ ...plan()[0], x: 0.99 }],
    [{ ...plan()[0], owner_id: "forged" }],
    [{ ...plan()[0], widthPt: 0 }],
    [{ ...plan()[0], rotation: 45 }],
  ])(
    "rejects malformed/outside/injected layout without committing anything (%j)",
    (invalid) =>
      tx(async (c) => {
        const f = await fixture(c);
        await denied(c, approveSQL, args(f, invalid), "22023");
        expect(
          (
            await c.query(
              "select count(*)::int as n from public.signing_decisions where request_id=$1",
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
  it("does not approve for the owner/outsider or after cancellation", () =>
    tx(async (c) => {
      const f = await fixture(c);
      for (const actor of [f.a, f.other]) {
        const values = args(f);
        values[0] = actor;
        await denied(c, approveSQL, values, "P0002");
      }
      await c.query("select public.cancel_signing_request($1,$2)", [
        f.a,
        f.request,
      ]);
      await denied(c, approveSQL, args(f), "P0001");
    }));
  it("shows placement only to actual participants, including denying monitoring admin", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f);
      for (const actor of [f.a, f.b, f.other]) {
        await role(c, "authenticated", actor);
        expect(
          (
            await c.query(
              "select receipt_id from public.signing_receipt_layouts where receipt_id=$1",
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
        (await c.query("select receipt_id from public.signing_receipt_layouts"))
          .rowCount,
      ).toBe(0);
    }));
  it("does not permit moving or deleting the stored plan even as an operator update", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f);
      await role(c, "postgres");
      await denied(
        c,
        "update public.signing_receipt_layouts set placement_plan=placement_plan where receipt_id=$1",
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
  it("accepts a one-page result and rejects an extra proof page", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = await approve(c, f),
        claim = (
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
      const values = [
          f.b,
          receipt.receiptId,
          claim.claimToken,
          path,
          5000,
          "c".repeat(64),
          2,
        ],
        sql =
          "select public.complete_signing_render($1,$2,$3,$4,$5,$6,$7) as ok";
      await denied(c, sql, values, "22023");
      values[6] = 1;
      expect((await c.query(sql, values)).rows[0].ok).toBe(true);
      expect((await c.query(sql, values)).rows[0].ok).toBe(true);
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [f.request],
          )
        ).rows[0].status,
      ).toBe("completed");
      expect(
        (
          await c.query(
            "select page_count from public.signing_artifacts where receipt_id=$1",
            [receipt.receiptId],
          )
        ).rows[0].page_count,
      ).toBe(1);
    }));
  it("keeps legacy receipt format separate and does not attach a V2 manifest to it", () =>
    tx(async (c) => {
      const f = await fixture(c);
      const receipt = (
        await c.query(
          "select public.decide_signing_request($1,$2,$3,$4,$5,'approve',null,$6,true,true,$7) as data",
          [
            f.b,
            f.request,
            randomUUID(),
            f.version,
            hash,
            policy,
            "b".repeat(64),
          ],
        )
      ).rows[0].data;
      await role(c, "postgres");
      await denied(
        c,
        "insert into public.signing_receipt_layouts(receipt_id,placement_plan,plan_sha256) values($1,$2::jsonb,encode(extensions.digest($2::jsonb::text,'sha256'),'hex'))",
        [receipt.receiptId, JSON.stringify(plan())],
        "23503",
      );
      await role(c, "service_role");
      const claim = (
        await c.query("select public.claim_signing_render($1,$2) as data", [
          f.b,
          receipt.receiptId,
        ])
      ).rows[0].data;
      await denied(
        c,
        "select public.complete_signing_render($1,$2,$3,$4,5000,$5,1)",
        [
          f.b,
          receipt.receiptId,
          claim.claimToken,
          `${f.a}/signing-results/${receipt.receiptId}/${claim.claimToken}.pdf`,
          "c".repeat(64),
        ],
        "22023",
      );
    }));
});
