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
  policy = "internal-action-2026-11-17";
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
    "select public.create_signing_draft($1,$2,$3,'Synthetic R3',$4,null,null,null,null,'r3.pdf',2831,$5,$6,'internal-upload-2026-11-17',true)",
    [a, doc, version, category, hash, path],
  );
  await c.query(
    "select public.send_signing_request($1,$2,$3,$4,$5,'internal-sharing-2026-11-17',true)",
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
const plan = [
  {
    page: 5,
    x: 0.1,
    y: 0.2,
    widthPt: 600,
    heightPt: 800,
    rotation: 0,
    userUnit: 1,
  },
];
function args(f: F, p = policy): unknown[] {
  return [
    f.b,
    f.request,
    randomUUID(),
    f.version,
    hash,
    p,
    true,
    true,
    "b".repeat(64),
    JSON.stringify(plan),
    5,
  ];
}
const approval =
  "select public.approve_signing_request_with_selected_pages($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11) as data";
describe("public service policy versions without rewriting historical records", () => {
  it("records current upload, sharing and approval policies on new rows", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = (await c.query(approval, args(f))).rows[0].data;
      const row = (
        await c.query(
          "select v.upload_policy_version,r.sharing_policy_version,d.policy_version,e.policy_version as receipt_policy from public.signing_requests r join public.signing_document_versions v on v.id=r.source_version_id join public.signing_decisions d on d.request_id=r.id join public.signing_receipts e on e.decision_id=d.id where r.id=$1",
          [f.request],
        )
      ).rows[0];
      expect(row).toEqual({
        upload_policy_version: "internal-upload-2026-11-17",
        sharing_policy_version: "internal-sharing-2026-11-17",
        policy_version: policy,
        receipt_policy: policy,
      });
      const metadata = (
        await c.query("select public.get_signing_public_metadata($1) as data", [
          receipt.receiptId,
        ])
      ).rows[0].data;
      expect(Object.keys(metadata).sort()).toEqual([
        "approvedAt",
        "documentTitle",
        "signerName",
        "status",
      ]);
    }));
  it("keeps current-policy exact retries idempotent and refuses rebinding consent to another policy", () =>
    tx(async (c) => {
      const f = await fixture(c),
        values = args(f),
        one = (await c.query(approval, values)).rows[0].data;
      expect((await c.query(approval, values)).rows[0].data).toEqual(one);
      const old = [...values];
      old[5] = "internal-action-development-2026-11-05";
      await denied(c, approval, old, "P0001");
      expect(
        (
          await c.query(
            "select count(*)::int n from public.signing_decisions where request_id=$1",
            [f.request],
          )
        ).rows[0].n,
      ).toBe(1);
    }));
  it("refuses unknown policy identifiers before recording an approval", () =>
    tx(async (c) => {
      const f = await fixture(c);
      await denied(c, approval, args(f, "future-unapproved-policy"), "22023");
      expect(
        (
          await c.query(
            "select count(*)::int n from public.signing_decisions where request_id=$1",
            [f.request],
          )
        ).rows[0].n,
      ).toBe(0);
    }));
  it("supports a rejection using the current policy without issuing a QR", () =>
    tx(async (c) => {
      const f = await fixture(c);
      const result = (
        await c.query(
          "select public.decide_signing_request($1,$2,$3,$4,$5,'reject','Tidak sesuai',$6,false,true,$7) as data",
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
      expect(result.action).toBe("reject");
      expect(result.receiptId).toBeNull();
    }));
  it("keeps public service policy metadata service-only and returns the agreed retention/scanning contract", () =>
    tx(async (c) => {
      await role(c, "service_role");
      const data = (
        await c.query("select public.get_document_service_policy() as data")
      ).rows[0].data;
      expect(data).toMatchObject({
        version: "public-service-2026-11-17",
        scanRequired: true,
        retention: "operator-request-no-auto-delete",
        actionPolicy: policy,
      });
      await role(c, "anon");
      await denied(c, "select public.get_document_service_policy()");
      await role(c, "authenticated");
      await denied(c, "select public.get_document_service_policy()");
    }));
  it("retains immutable current-policy receipt history", () =>
    tx(async (c) => {
      const f = await fixture(c),
        receipt = (await c.query(approval, args(f))).rows[0].data;
      await role(c, "postgres");
      await denied(
        c,
        "update public.signing_receipts set policy_version='internal-action-development-2026-11-05' where id=$1",
        [receipt.receiptId],
        "P0001",
      );
    }));
});
