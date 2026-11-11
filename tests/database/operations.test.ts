import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { operationsSnapshotSchema } from "../../src/lib/operations/schema";
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  process.env.DVP_DATABASE_TEST_ISOLATED !== "1" ||
  new URL(url).hostname !== "127.0.0.1"
)
  throw new Error("Use the isolated database runner.");
const pool = new Pool({
  connectionString: url,
  max: 2,
  statement_timeout: 10000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,
});
const hash = "a".repeat(64);
async function role(
  c: PoolClient,
  value: "postgres" | "service_role" | "authenticated" | "anon",
  actor?: string,
) {
  await c.query(`set local role ${value}`);
  await c.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true),set_config('request.jwt.claims',$3,true)",
    [
      actor ?? "",
      value,
      JSON.stringify({ role: value, ...(actor ? { sub: actor } : {}) }),
    ],
  );
}
async function tx(run: (c: PoolClient) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query("begin isolation level repeatable read");
    await run(c);
  } finally {
    await c.query("rollback");
    c.release();
  }
}
async function user(c: PoolClient, admin = false, confirmed = true) {
  await role(c, "postgres");
  const id = randomUUID();
  await c.query(
    "insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values($1,case when $2 then now() else null end,'{}')",
    [id, confirmed],
  );
  if (admin)
    await c.query(
      "insert into public.user_roles(user_id,role) values($1,'platform_admin')",
      [id],
    );
  return id;
}
async function snapshot(c: PoolClient, id: string) {
  await role(c, "authenticated", id);
  const data = (
    await c.query("select public.get_operations_snapshot() as data")
  ).rows[0].data;
  await role(c, "postgres");
  return operationsSnapshotSchema.parse(data);
}
async function denied(
  c: PoolClient,
  sql: string,
  values: unknown[] = [],
  code = "42501",
) {
  await c.query("savepoint denied");
  let error: unknown;
  try {
    await c.query(sql, values);
  } catch (e) {
    error = e;
  } finally {
    await c.query("rollback to savepoint denied");
    await c.query("release savepoint denied");
  }
  expect(error).toBeInstanceOf(Error);
  expect((error as { code: string }).code).toBe(code);
}
async function draft(c: PoolClient, owner: string, recipient?: string) {
  await role(c, "postgres");
  const doc = randomUUID(),
    version = randomUUID(),
    request = randomUUID();
  const category = (
    await c.query(
      "select id from public.document_categories where slug='pendidikan'",
    )
  ).rows[0].id;
  const path = `${owner}/signing/${doc}/${version}.pdf`;
  await c.query(
    "insert into storage.objects(bucket_id,name) values('document-submissions',$1)",
    [path],
  );
  await role(c, "service_role");
  await c.query(
    "select public.create_signing_draft($1,$2,$3,'Synthetic operations',$4,null,null,null,null,'ops.pdf',1544,$5,$6,'internal-upload-development-2026-11-05',true)",
    [owner, doc, version, category, hash, path],
  );
  if (recipient) {
    await role(c, "postgres");
    const code = (
      await c.query(
        "select code from public.signing_user_identifiers where user_id=$1",
        [recipient],
      )
    ).rows[0].code;
    await role(c, "service_role");
    await c.query(
      "select public.send_signing_request($1,$2,$3,$4,$5,'internal-sharing-development-2026-11-05',true)",
      [owner, request, version, code, recipient],
    );
  }
  await role(c, "postgres");
  return { doc, version, request, owner, recipient, category };
}
type Draft = Awaited<ReturnType<typeof draft>>;
async function decision(c: PoolClient, f: Draft, action = "approve") {
  await role(c, "service_role");
  const d = (
    await c.query(
      "select public.decide_signing_request($1,$2,$3,$4,$5,$6,$7,'internal-action-development-2026-11-05',$8,true,$9) as data",
      [
        f.recipient,
        f.request,
        randomUUID(),
        f.version,
        hash,
        action,
        action === "reject" ? "Synthetic rejection" : null,
        action === "approve",
        hash,
      ],
    )
  ).rows[0].data;
  await role(c, "postgres");
  return d as { receiptId: string; decisionId: string };
}
async function claim(c: PoolClient, actor: string, receipt: string) {
  await role(c, "service_role");
  const x = (
    await c.query("select public.claim_signing_render($1,$2) as data", [
      actor,
      receipt,
    ])
  ).rows[0].data;
  await role(c, "postgres");
  return x.claimToken as string;
}
async function finish(
  c: PoolClient,
  owner: string,
  actor: string,
  receipt: string,
  token: string,
) {
  const path = `${owner}/signing-results/${receipt}/${token}.pdf`;
  await role(c, "postgres");
  await c.query(
    "insert into storage.objects(bucket_id,name) values('signing-results',$1)",
    [path],
  );
  await role(c, "service_role");
  await c.query(
    "select public.complete_signing_render($1,$2,$3,$4,6177,$5,2)",
    [actor, receipt, token, path, "b".repeat(64)],
  );
  await role(c, "postgres");
}
async function historical(c: PoolClient, owner: string, when: string) {
  await role(c, "postgres");
  const doc = randomUUID(),
    version = randomUUID();
  const category = (
    await c.query(
      "select id from public.document_categories where slug='pendidikan'",
    )
  ).rows[0].id;
  await c.query(
    "insert into public.signing_documents(id,owner_id,created_at) values($1,$2,$3)",
    [doc, owner, when],
  );
  await c.query(
    "insert into public.signing_document_versions(id,document_id,owner_id,version_no,title,category_id,original_filename,file_size_bytes,source_sha256,storage_path,upload_policy_version,consented_at,created_at) values($1,$2,$3,1,'Synthetic history',$4,'history.pdf',1544,$5,$6,'internal-upload-development-2026-11-05',$7,$7)",
    [
      version,
      doc,
      owner,
      category,
      hash,
      `${owner}/signing/${doc}/${version}.pdf`,
      when,
    ],
  );
  await c.query(
    "insert into private.signing_audit_events(actor_id,action,document_id,version_id,created_at) values($1,'draft_created',$2,$3,$4)",
    [owner, doc, version, when],
  );
  return { doc, version, category };
}
afterAll(() => pool.end());
async function editorGrant(target?: string, operator?: string) {
  let sql = await readFile(
    "supabase/operators/grant-platform-admin-dashboard.sql",
    "utf8",
  );
  if (target) sql = sql.replace("PASTE_TARGET_USER_UUID", target);
  if (operator) sql = sql.replace("PASTE_OPERATOR_USER_UUID", operator);
  return sql.replace(/^begin;$/m, "").replace(/^commit;$/m, "");
}
describe("SQL Editor initial admin setup stays restricted to a trusted operator", () => {
  it("refuses an unedited placeholder script", () =>
    tx(async (c) => {
      await denied(c, await editorGrant(), [], "22023");
    }));
  it("requires both target and actual operator records before granting anything", () =>
    tx(async (c) => {
      const actor = await user(c);
      await denied(c, await editorGrant(randomUUID(), actor), [], "P0002");
      await denied(c, await editorGrant(actor, randomUUID()), [], "P0002");
      expect(
        (
          await c.query(
            "select count(*)::int as n from public.user_roles where user_id=$1 and role='platform_admin'",
            [actor],
          )
        ).rows[0].n,
      ).toBe(0);
    }));
  it("supports initial self-bootstrap with one audit event and preserves duplicate attribution", () =>
    tx(async (c) => {
      const actor = await user(c),
        other = await user(c);
      await c.query(await editorGrant(actor, actor));
      expect(
        (
          await c.query(
            "select granted_by from public.user_roles where user_id=$1 and role='platform_admin'",
            [actor],
          )
        ).rows[0].granted_by,
      ).toBe(actor);
      await c.query(await editorGrant(actor, other));
      const rows = (
        await c.query(
          "select actor_user_id,metadata from public.audit_logs where action='role.granted' and resource_id=$1",
          [actor],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_user_id).toBe(actor);
      expect(rows[0].metadata).toEqual({
        role: "platform_admin",
        changed: true,
      });
      await snapshot(c, actor);
    }));
  it.each(["anon", "authenticated", "service_role"] as const)(
    "denies %s even with valid target/operator IDs",
    (kind) =>
      tx(async (c) => {
        const actor = await user(c);
        await role(c, kind, actor);
        await denied(c, await editorGrant(actor, actor));
      }),
  );
});
describe("R4 read-only monitoring using authoritative identity and role", () => {
  it("grants only explicit EXECUTE and keeps the RPC stable/security-definer", () =>
    tx(async (c) => {
      const row = (
        await c.query(
          "select has_function_privilege('anon','public.get_operations_snapshot()','EXECUTE') as anon,has_function_privilege('authenticated','public.get_operations_snapshot()','EXECUTE') as authed,prosecdef,provolatile,proconfig from pg_proc where oid='public.get_operations_snapshot()'::regprocedure",
        )
      ).rows[0];
      expect(row.anon).toBe(false);
      expect(row.authed).toBe(true);
      expect(row.prosecdef).toBe(true);
      expect(row.provolatile).toBe("s");
      expect(row.proconfig).toContain('search_path=""');
    }));
  it.each(["anon", "service_role"] as const)(
    "rejects %s even when an admin ID is injected into its claims",
    (kind) =>
      tx(async (c) => {
        const admin = await user(c, true);
        await role(c, kind, admin);
        await denied(c, "select public.get_operations_snapshot()");
      }),
  );
  it.each(["user", "reviewer", "unverified", "spoofed"])(
    "denies %s accounts",
    (kind) =>
      tx(async (c) => {
        const actor = await user(
          c,
          kind === "unverified",
          kind !== "unverified",
        );
        if (kind === "reviewer")
          await c.query(
            "insert into public.user_roles(user_id,role) values($1,'reviewer')",
            [actor],
          );
        if (kind === "spoofed")
          await c.query(
            "update auth.users set raw_app_meta_data='{" +
              '"roles":["platform_admin"]' +
              "}'::jsonb,raw_user_meta_data='{" +
              '"role":"platform_admin"' +
              "}'::jsonb where id=$1",
            [actor],
          );
        await role(c, "authenticated", actor);
        await denied(c, "select public.get_operations_snapshot()");
      }),
  );
  it("does not accept a client-supplied actor argument", () =>
    tx(async (c) => {
      const admin = await user(c, true);
      await role(c, "authenticated", admin);
      await denied(
        c,
        "select public.get_operations_snapshot($1::uuid)",
        [admin],
        "42883",
      );
    }));
  it("allows mixed admin/reviewer roles but denies the same session after admin revocation", () =>
    tx(async (c) => {
      const admin = await user(c, true);
      await c.query(
        "insert into public.user_roles(user_id,role) values($1,'reviewer')",
        [admin],
      );
      await snapshot(c, admin);
      await c.query(
        "delete from public.user_roles where user_id=$1 and role='platform_admin'",
        [admin],
      );
      await role(c, "authenticated", admin);
      await denied(c, "select public.get_operations_snapshot()");
    }));
  it.each(["banned_until", "deleted_at"])(
    "denies an admin with provider %s set despite an existing JWT",
    (column) =>
      tx(async (c) => {
        const admin = await user(c, true);
        await c.query(
          `update auth.users set ${column}=now()+interval '1 day' where id=$1`,
          [admin],
        );
        await role(c, "authenticated", admin);
        await denied(c, "select public.get_operations_snapshot()");
      }),
  );
  it("allows an expired provider ban and does not require a user/reviewer role for monitoring", () =>
    tx(async (c) => {
      const admin = await user(c, true);
      await c.query(
        "update auth.users set banned_until=now()-interval '1 day' where id=$1",
        [admin],
      );
      await c.query(
        "delete from public.user_roles where user_id=$1 and role='user'",
        [admin],
      );
      await snapshot(c, admin);
    }));
  it("counts logical signing documents separately from versions and legacy approvals", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        base = await snapshot(c, admin),
        a = await user(c),
        b = await user(c),
        unverified = await user(c, false, false);
      void unverified;
      const f = await draft(c, a, b);
      await draft(c, a);
      await c.query(
        "insert into public.signing_documents(id,owner_id) values($1,$2)",
        [randomUUID(), a],
      );
      await c.query(
        "insert into public.signing_document_versions(id,document_id,owner_id,version_no,title,category_id,original_filename,file_size_bytes,source_sha256,storage_path,upload_policy_version,consented_at,created_at) select $1::uuid,document_id,owner_id,2,title,category_id,'version2.pdf',file_size_bytes,source_sha256,owner_id::text||'/signing/'||document_id::text||'/'||$1::uuid::text||'.pdf',upload_policy_version,statement_timestamp(),statement_timestamp() from public.signing_document_versions where id=$2",
        [randomUUID(), f.version],
      );
      await c.query(
        "insert into public.documents(owner_id,current_status,registered_at) values($1,'approved',now())",
        [a],
      );
      const x = await snapshot(c, admin);
      expect(x.metrics.registeredUsers - base.metrics.registeredUsers).toBe(3);
      expect(x.metrics.uploadedDocuments - base.metrics.uploadedDocuments).toBe(
        2,
      );
      expect(x.metrics.sourceVersions - base.metrics.sourceVersions).toBe(3);
      expect(x.metrics.legacyDocuments - base.metrics.legacyDocuments).toBe(1);
      expect(x.metrics.completedDocuments).toBe(
        base.metrics.completedDocuments,
      );
      expect(
        x.metrics.activeDocumentUsers30d! -
          base.metrics.activeDocumentUsers30d!,
      ).toBe(1);
    }));
  it("counts committed approval as awaiting until a ready result is finalized once", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        base = await snapshot(c, admin),
        a = await user(c),
        b = await user(c),
        f = await draft(c, a, b);
      expect(
        (await snapshot(c, admin)).metrics.pendingRequests -
          base.metrics.pendingRequests,
      ).toBe(1);
      const d = await decision(c, f),
        pending = await snapshot(c, admin);
      expect(pending.metrics.completedDocuments).toBe(
        base.metrics.completedDocuments,
      );
      expect(
        pending.metrics.awaitingResults - base.metrics.awaitingResults,
      ).toBe(1);
      expect(
        pending.metrics.activeDocumentUsers30d! -
          base.metrics.activeDocumentUsers30d!,
      ).toBe(2);
      const token = await claim(c, b, d.receiptId);
      expect(
        (await snapshot(c, admin)).metrics.processingResults -
          base.metrics.processingResults,
      ).toBe(1);
      await finish(c, a, b, d.receiptId, token);
      const ready = await snapshot(c, admin);
      expect(
        ready.metrics.completedDocuments - base.metrics.completedDocuments,
      ).toBe(1);
      expect(ready.metrics.awaitingResults).toBe(base.metrics.awaitingResults);
      expect(ready.metrics.processingResults).toBe(
        base.metrics.processingResults,
      );
      await role(c, "service_role");
      await c.query(
        "select public.complete_signing_render($1,$2,$3,$4,6177,$5,2)",
        [
          b,
          d.receiptId,
          token,
          `${a}/signing-results/${d.receiptId}/${token}.pdf`,
          "b".repeat(64),
        ],
      );
      expect((await snapshot(c, admin)).metrics.completedDocuments).toBe(
        ready.metrics.completedDocuments,
      );
    }));
  it("removes failures after successful retry and identifies abandoned processing without writing", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        base = await snapshot(c, admin),
        a = await user(c),
        b = await user(c),
        f = await draft(c, a, b),
        d = await decision(c, f);
      const first = await claim(c, b, d.receiptId);
      await role(c, "service_role");
      await c.query(
        "select public.fail_signing_render($1,$2,$3,'STORAGE_UNAVAILABLE')",
        [b, d.receiptId, first],
      );
      const failed = await snapshot(c, admin),
        ref = (
          await c.query(
            "select encode(extensions.digest($1,'sha256'),'hex') as ref",
            [d.receiptId],
          )
        ).rows[0].ref;
      expect(
        failed.metrics.attentionResults - base.metrics.attentionResults,
      ).toBe(1);
      expect(
        failed.attention.items.find((i) => i.reference === ref),
      ).toMatchObject({
        state: "failed",
        code: "STORAGE_UNAVAILABLE",
        attempts: 1,
      });
      await claim(c, b, d.receiptId);
      await c.query(
        "update private.signing_render_jobs set lease_until=clock_timestamp()-interval '1 minute' where receipt_id=$1",
        [d.receiptId],
      );
      const before = (
        await c.query(
          "select * from private.signing_render_jobs where receipt_id=$1",
          [d.receiptId],
        )
      ).rows[0];
      const expired = await snapshot(c, admin);
      expect(
        expired.attention.items.find((i) => i.reference === ref),
      ).toMatchObject({
        state: "timed_out",
        code: "PROCESSING_TIMEOUT",
        attempts: 2,
      });
      expect(
        (
          await c.query(
            "select * from private.signing_render_jobs where receipt_id=$1",
            [d.receiptId],
          )
        ).rows[0],
      ).toEqual(before);
      const retry = await claim(c, b, d.receiptId);
      await finish(c, a, b, d.receiptId, retry);
      const healed = await snapshot(c, admin);
      expect(healed.metrics.attentionResults).toBe(
        base.metrics.attentionResults,
      );
      expect(healed.attention.items.some((i) => i.reference === ref)).toBe(
        false,
      );
    }));
  it("uses one rolling 720-hour event window, excludes future/old activity and deduplicates actors", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        base = await snapshot(c, admin),
        old = await user(c),
        future = await user(c),
        recent = await user(c);
      const when = (expr: string) =>
        c.query(`select (statement_timestamp()+${expr})::text as t`);
      await historical(c, old, (await when("interval '-31 days'")).rows[0].t);
      await historical(c, future, (await when("interval '1 day'")).rows[0].t);
      const f = await historical(
        c,
        recent,
        (await when("interval '-29 days'")).rows[0].t,
      );
      await c.query(
        "insert into private.signing_audit_events(actor_id,action,document_id,version_id,created_at) select actor_id,action,document_id,version_id,created_at from private.signing_audit_events where version_id=$1",
        [f.version],
      );
      const x = await snapshot(c, admin);
      expect(
        x.metrics.activeDocumentUsers30d! -
          base.metrics.activeDocumentUsers30d!,
      ).toBe(1);
      expect(Date.parse(x.asOf) - Date.parse(x.periodStart)).toBe(
        720 * 3600 * 1000,
      );
    }));
  it("excludes cancelled, rejected and expired requests from pending without creating an expiry job", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        base = await snapshot(c, admin),
        a = await user(c),
        b = await user(c),
        cancel = await draft(c, a, b),
        reject = await draft(c, a, b),
        expired = await draft(c, a);
      await role(c, "service_role");
      await c.query("select public.cancel_signing_request($1,$2)", [
        a,
        cancel.request,
      ]);
      await decision(c, reject, "reject");
      await c.query(
        "insert into public.signing_requests(id,document_id,source_version_id,owner_id,recipient_id,owner_display_name,recipient_display_name,status,sent_at,expires_at,sharing_policy_version,sharing_consented_at) values($1,$2,$3,$4,$5,'Synthetic owner','Synthetic recipient','pending',now()-interval '10 days',now()-interval '10 days'+interval '168 hours','internal-sharing-development-2026-11-05',now()-interval '10 days')",
        [expired.request, expired.doc, expired.version, a, b],
      );
      expect((await snapshot(c, admin)).metrics.pendingRequests).toBe(
        base.metrics.pendingRequests,
      );
      expect(
        (
          await c.query(
            "select status from public.signing_requests where id=$1",
            [expired.request],
          )
        ).rows[0].status,
      ).toBe("pending");
    }));
  it("caps attention metadata at 20 with an accurate total and safe references", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        base = await snapshot(c, admin),
        a = await user(c),
        b = await user(c);
      const ownRefs = new Set<string>();
      for (let i = 0; i < 22; i++) {
        const f = await draft(c, a, b),
          d = await decision(c, f),
          token = await claim(c, b, d.receiptId);
        await role(c, "service_role");
        await c.query(
          "select public.fail_signing_render($1,$2,$3,'RENDER_FAILED')",
          [b, d.receiptId, token],
        );
        await role(c, "postgres");
        ownRefs.add(d.receiptId);
      }
      const x = await snapshot(c, admin);
      expect(x.attention.total - base.attention.total).toBe(22);
      expect(x.attention.items).toHaveLength(20);
      expect(x.attention.hasMore).toBe(true);
      for (const item of x.attention.items) {
        expect(Object.keys(item).sort()).toEqual([
          "attempts",
          "code",
          "reference",
          "state",
          "updatedAt",
        ]);
        expect(ownRefs.has(item.reference)).toBe(false);
      }
      expect(JSON.stringify(x)).not.toMatch(
        /Synthetic|storage_path|source_sha256|owner_id|recipient_id|claim_token|@/,
      );
    }));
  it("adds no content, private audit, mutation or Storage access to platform administrators", () =>
    tx(async (c) => {
      const admin = await user(c, true),
        a = await user(c),
        b = await user(c),
        f = await draft(c, a, b),
        d = await decision(c, f);
      await snapshot(c, admin);
      await role(c, "authenticated", admin);
      for (const table of [
        "signing_documents",
        "signing_document_versions",
        "signing_requests",
        "signing_decisions",
        "signing_receipts",
        "signing_artifacts",
        "signing_receipt_layouts",
      ]) {
        expect(
          (await c.query(`select count(*)::int as n from public.${table}`))
            .rows[0].n,
        ).toBe(0);
      }
      await denied(c, "select * from private.signing_audit_events");
      await denied(
        c,
        "update public.signing_artifacts set state='failed' where receipt_id=$1",
        [d.receiptId],
      );
      await denied(
        c,
        "insert into public.user_roles(user_id,role) values($1,'platform_admin')",
        [a],
      );
      expect(
        (
          await c.query(
            "select count(*)::int as n from storage.objects where bucket_id in ('document-submissions','signing-results')",
          )
        ).rows[0].n,
      ).toBe(0);
    }));
});
