import { randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_TEST_URL;
if (!databaseUrl || process.env.DVP_DATABASE_TEST_ISOLATED !== "1")
  throw new Error("Run signing SQL tests through npm run test:db.");
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/postgres")
  throw new Error("Signing SQL tests require the isolated loopback cluster.");
const pool = new Pool({
  connectionString: databaseUrl,
  max: 4,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  allowExitOnIdle: true,
});
const uploadPolicy = "internal-upload-development-2026-11-05";
const sharingPolicy = "internal-sharing-development-2026-11-05";
const digest = () => randomBytes(32).toString("hex");
type Role = "postgres" | "authenticated" | "anon" | "service_role";
type Receipt = {
  requestId: string;
  documentId: string;
  sourceVersionId: string;
  status: string;
  sentAt: string;
  expiresAt: string;
  cancelledAt: string | null;
};
async function actor(connection: PoolClient, role: Role, user?: string) {
  await connection.query(`set local role ${role}`);
  await connection.query("select set_config('request.jwt.claim.sub',$1,true)", [
    user ?? "",
  ]);
  await connection.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify(user ? { sub: user, role } : { role }),
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
async function denied(
  connection: PoolClient,
  sql: string,
  values: unknown[] = [],
  code = "42501",
  message?: string,
) {
  await connection.query("savepoint signing_denied");
  let failure: unknown;
  try {
    await connection.query(sql, values);
  } catch (error) {
    failure = error;
  } finally {
    await connection.query("rollback to savepoint signing_denied");
    await connection.query("release savepoint signing_denied");
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as { code?: string }).code).toBe(code);
  if (message) expect((failure as Error).message).toBe(message);
}
async function fixtures(connection: PoolClient) {
  await actor(connection, "postgres");
  const a = randomUUID();
  const b = randomUUID();
  const c = randomUUID();
  const admin = randomUUID();
  const reviewer = randomUUID();
  const unverified = randomUUID();
  const noUser = randomUUID();
  for (const [id, name] of [
    [a, "Synthetic owner"],
    [b, "Synthetic recipient"],
    [c, "Synthetic unrelated"],
    [admin, "Synthetic administrator"],
    [reviewer, "Synthetic reviewer"],
    [unverified, "Synthetic unverified"],
    [noUser, "Synthetic without user role"],
  ])
    await connection.query(
      "insert into auth.users(id,raw_user_meta_data,email_confirmed_at) values ($1,jsonb_build_object('full_name',$2::text),case when $3::boolean then now() else null end)",
      [id, name, id !== unverified],
    );
  await connection.query(
    "insert into public.user_roles(user_id,role) values ($1,'platform_admin'),($2,'reviewer');",
    [admin, reviewer],
  );
  await connection.query("delete from public.user_roles where user_id=$1", [
    noUser,
  ]);
  const rows = (
    await connection.query<{ user_id: string; code: string }>(
      "select user_id,code from public.signing_user_identifiers where user_id=any($1::uuid[])",
      [[a, b, c, admin, reviewer, unverified, noUser]],
    )
  ).rows;
  const codes = Object.fromEntries(rows.map((row) => [row.user_id, row.code]));
  const categories = (
    await connection.query<{ id: string; slug: string }>(
      "select id,slug from public.document_categories where slug in ('pendidikan','lainnya')",
    )
  ).rows;
  return {
    a,
    b,
    c,
    admin,
    reviewer,
    unverified,
    noUser,
    codes,
    category: categories.find((row) => row.slug === "pendidikan")!.id,
    otherCategory: categories.find((row) => row.slug === "lainnya")!.id,
  };
}
type Fixture = Awaited<ReturnType<typeof fixtures>>;
const draftSQL =
  "select public.create_signing_draft($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) as receipt";
async function draftArguments(
  connection: PoolClient,
  fixture: Fixture,
  owner = fixture.a,
) {
  const document = randomUUID();
  const version = randomUUID();
  const storagePath = `${owner}/signing/${document}/${version}.pdf`;
  await actor(connection, "postgres");
  await connection.query(
    "insert into storage.objects(bucket_id,name) values ('document-submissions',$1)",
    [storagePath],
  );
  return {
    document,
    version,
    storagePath,
    args: [
      owner,
      document,
      version,
      "Synthetic internal document",
      fixture.category,
      null,
      "2026-11-05",
      "Synthetic institution",
      "Synthetic development fixture without personal data",
      "synthetic-development.pdf",
      2800,
      "a".repeat(64),
      storagePath,
      uploadPolicy,
      true,
    ] as unknown[],
  };
}
async function draft(
  connection: PoolClient,
  fixture: Fixture,
  owner = fixture.a,
) {
  const input = await draftArguments(connection, fixture, owner);
  await actor(connection, "service_role");
  const receipt = (await connection.query(draftSQL, input.args)).rows[0]
    .receipt;
  return { ...input, receipt };
}
async function send(
  connection: PoolClient,
  fixture: Fixture,
  version: string,
  request: string = randomUUID(),
  owner = fixture.a,
  recipient = fixture.b,
) {
  await actor(connection, "service_role");
  return (
    await connection.query<{ receipt: Receipt }>(
      "select public.send_signing_request($1,$2,$3,$4,$5,$6,true) as receipt",
      [
        owner,
        request,
        version,
        fixture.codes[recipient],
        recipient,
        sharingPolicy,
      ],
    )
  ).rows[0]!.receipt;
}
async function cancel(connection: PoolClient, owner: string, request: string) {
  await actor(connection, "service_role");
  return (
    await connection.query<{ receipt: Receipt }>(
      "select public.cancel_signing_request($1,$2) as receipt",
      [owner, request],
    )
  ).rows[0]!.receipt;
}
// Trusted operator fixtures are used only to exercise future-state and expiry
// SELECT policies. R2 production RPCs never issue these future decision states.
async function historicalRequest(
  connection: PoolClient,
  fixture: Fixture,
  document: string,
  version: string,
  status: "pending" | "rejected" | "consented" | "completed",
) {
  const id = randomUUID();
  await actor(connection, "postgres");
  await connection.query(
    `insert into public.signing_requests(id,document_id,source_version_id,owner_id,recipient_id,
    owner_display_name,recipient_display_name,status,sent_at,expires_at,sharing_policy_version,sharing_consented_at)
    values ($1,$2,$3,$4,$5,'Synthetic owner','Synthetic recipient',$6,
      now()-interval '8 days',now()-interval '8 days'+interval '168 hours',$7,now()-interval '8 days')`,
    [id, document, version, fixture.a, fixture.b, status, sharingPolicy],
  );
  return id;
}
afterAll(async () => {
  await pool.end();
});

describe("R2 immutable internal request foundation", () => {
  it("allows trusted deletion of an unused account while retaining owners and recipients with document history", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const deletedCode = f.codes[f.c];
      await connection.query("delete from auth.users where id=$1", [f.c]);
      expect(
        (
          await connection.query(
            "select user_id from public.signing_user_identifiers where user_id=$1 or code=$2",
            [f.c, deletedCode],
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await connection.query(
            "select code from public.signing_user_identifiers where user_id=$1",
            [f.a],
          )
        ).rows,
      ).toEqual([{ code: f.codes[f.a] }]);
      const source = await draft(connection, f);
      await actor(connection, "postgres");
      await denied(
        connection,
        "delete from auth.users where id=$1",
        [f.a],
        "23503",
      );
      const request = await send(connection, f, source.version);
      await cancel(connection, f.a, request.requestId);
      await actor(connection, "postgres");
      for (const participant of [f.a, f.b])
        await denied(
          connection,
          "delete from auth.users where id=$1",
          [participant],
          "23503",
        );
      expect(
        (
          await connection.query(
            "select status from public.signing_requests where id=$1",
            [request.requestId],
          )
        ).rows,
      ).toEqual([{ status: "cancelled" }]);
    });
  });

  it("provisions stable unique 80-bit account codes without exposing others' codes", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      expect(new Set(Object.values(f.codes)).size).toBe(7);
      for (const code of Object.values(f.codes))
        expect(code).toMatch(/^DVP-[A-F0-9]{20}$/);
      await actor(connection, "authenticated", f.a);
      expect(
        (
          await connection.query(
            "select user_id,code from public.signing_user_identifiers",
          )
        ).rows,
      ).toEqual([{ user_id: f.a, code: f.codes[f.a] }]);
      await connection.query(
        "update public.profiles set full_name='Changed name' where id=$1",
        [f.a],
      );
      expect(
        (
          await connection.query(
            "select code from public.signing_user_identifiers",
          )
        ).rows[0].code,
      ).toBe(f.codes[f.a]);
      await actor(connection, "postgres");
      await denied(
        connection,
        "update public.signing_user_identifiers set code=$1 where user_id=$2",
        ["DVP-" + "A".repeat(20), f.a],
        "P0001",
        "IMMUTABLE_RECORD",
      );
    });
  });

  it("returns only exact eligible recipient identity without email or enumeration fields", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      await actor(connection, "service_role");
      expect(
        (
          await connection.query(
            "select public.lookup_signing_recipient($1,$2) as recipient",
            [f.a, f.codes[f.b]],
          )
        ).rows[0].recipient,
      ).toEqual({
        id: f.b,
        code: f.codes[f.b],
        displayName: "Synthetic recipient",
      });
      for (const recipient of [f.a, f.unverified, f.noUser])
        await denied(
          connection,
          "select public.lookup_signing_recipient($1,$2)",
          [f.a, f.codes[recipient]],
          "P0001",
          "SIGNING_RECIPIENT_UNAVAILABLE",
        );
      await denied(
        connection,
        "select public.lookup_signing_recipient($1,$2)",
        [f.a, "DVP-" + "0".repeat(20)],
        "P0001",
        "SIGNING_RECIPIENT_UNAVAILABLE",
      );
      for (const malformed of [
        null,
        "",
        f.codes[f.b]!.toLowerCase(),
        f.codes[f.b] + "%",
      ])
        await denied(
          connection,
          "select public.lookup_signing_recipient($1,$2)",
          [f.a, malformed],
          "22023",
          "INVALID_SIGNING_INPUT",
        );
    });
  });

  it.each(["unverified", "noUser"] as const)(
    "rejects %s actors despite trusted service credentials",
    async (name) => {
      await transaction(async (connection) => {
        const f = await fixtures(connection);
        const input = await draftArguments(connection, f, f[name]);
        await actor(connection, "service_role");
        await denied(
          connection,
          draftSQL,
          input.args,
          "42501",
          "SIGNING_ACTOR_REQUIRED",
        );
        await denied(
          connection,
          "select public.lookup_signing_recipient($1,$2)",
          [f[name], f.codes[f.b]],
          "42501",
          "SIGNING_ACTOR_REQUIRED",
        );
        await denied(
          connection,
          "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
          [
            f[name],
            randomUUID(),
            randomUUID(),
            f.codes[f.b],
            f.b,
            sharingPolicy,
          ],
          "42501",
          "SIGNING_ACTOR_REQUIRED",
        );
        await denied(
          connection,
          "select public.cancel_signing_request($1,$2)",
          [f[name], randomUUID()],
          "42501",
          "SIGNING_ACTOR_REQUIRED",
        );
      });
    },
  );

  it("stores canonical draft metadata, consent and source hash with an idempotent receipt", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const input = await draftArguments(connection, f);
      input.args[3] = "  Synthetic title  ";
      input.args[8] = "  ";
      await actor(connection, "service_role");
      const first = (await connection.query(draftSQL, input.args)).rows[0]
        .receipt;
      const retry = (await connection.query(draftSQL, input.args)).rows[0]
        .receipt;
      expect(retry).toEqual(first);
      expect(first).toMatchObject({
        documentId: input.document,
        versionId: input.version,
        versionNo: 1,
        status: "draft",
      });
      await actor(connection, "authenticated", f.a);
      expect(
        (
          await connection.query(
            "select title,description,source_sha256,upload_policy_version,consented_at=created_at as exact_consent from public.signing_document_versions where id=$1",
            [input.version],
          )
        ).rows,
      ).toEqual([
        {
          title: "Synthetic title",
          description: null,
          source_sha256: "a".repeat(64),
          upload_policy_version: uploadPolicy,
          exact_consent: true,
        },
      ]);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select action from private.signing_audit_events where document_id=$1",
            [input.document],
          )
        ).rows,
      ).toEqual([{ action: "draft_created" }]);
      await actor(connection, "service_role");
      input.args[11] = "b".repeat(64);
      await denied(
        connection,
        draftSQL,
        input.args,
        "P0001",
        "SIGNING_IDEMPOTENCY_CONFLICT",
      );
    });
  });

  it.each([
    [3, ""],
    [3, "x".repeat(201)],
    [5, "x".repeat(121)],
    [6, "10000-01-01"],
    [7, "x".repeat(201)],
    [8, "x".repeat(2001)],
    [9, "../private.pdf"],
    [9, "back\\slash.pdf"],
    [9, "bad\nname.pdf"],
    [9, "not-pdf.txt"],
    [10, 0],
    [10, 10485761],
    [11, "A".repeat(64)],
    [11, "not-a-hash"],
    [12, "other-user/signing/source.pdf"],
    [13, "outdated-policy"],
    [14, false],
    [14, null],
  ])(
    "rejects malformed draft argument %i before persisting data",
    async (index, value) => {
      await transaction(async (connection) => {
        const f = await fixtures(connection);
        const input = await draftArguments(connection, f);
        input.args[index as number] = value;
        await actor(connection, "service_role");
        await denied(
          connection,
          draftSQL,
          input.args,
          "22023",
          "INVALID_SIGNING_INPUT",
        );
        expect(
          (
            await connection.query(
              "select id from public.signing_documents where id=$1",
              [input.document],
            )
          ).rows,
        ).toEqual([]);
      });
    },
  );

  it("enforces current categories, conditional Other fields, and actual private source existence", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const input = await draftArguments(connection, f);
      await actor(connection, "service_role");
      input.args[5] = "Incompatible custom type";
      await denied(connection, draftSQL, input.args, "22023");
      input.args[4] = f.otherCategory;
      input.args[5] = null;
      await denied(connection, draftSQL, input.args, "22023");
      input.args[5] = "Other internal record";
      expect(
        (await connection.query(draftSQL, input.args)).rows[0].receipt.status,
      ).toBe("draft");
      const absent = await draftArguments(connection, f);
      await connection.query("delete from storage.objects where name=$1", [
        absent.storagePath,
      ]);
      await actor(connection, "service_role");
      await denied(connection, draftSQL, absent.args, "22023");
      await actor(connection, "postgres");
      await connection.query(
        "update public.document_categories set is_active=false where id=$1",
        [f.category],
      );
      await actor(connection, "service_role");
      await denied(connection, draftSQL, absent.args, "22023");
    });
  });

  it("freezes exactly one owner/source/recipient request for 168 hours and sends generic notification once", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const source = await draft(connection, f);
      const first = await send(connection, f, source.version);
      expect(first.status).toBe("pending");
      expect(Date.parse(first.expiresAt) - Date.parse(first.sentAt)).toBe(
        168 * 60 * 60 * 1000,
      );
      expect(
        await send(connection, f, source.version, first.requestId),
      ).toEqual(first);
      await denied(
        connection,
        "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
        [
          f.a,
          first.requestId,
          source.version,
          f.codes[f.c],
          f.c,
          sharingPolicy,
        ],
        "P0001",
        "SIGNING_IDEMPOTENCY_CONFLICT",
      );
      await denied(
        connection,
        "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
        [f.a, randomUUID(), source.version, f.codes[f.b], f.b, sharingPolicy],
        "P0001",
        "SIGNING_DOCUMENT_NOT_ELIGIBLE",
      );
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select action from private.signing_audit_events where document_id=$1 order by id",
            [source.document],
          )
        ).rows,
      ).toEqual([{ action: "draft_created" }, { action: "request_sent" }]);
      const notices = (
        await connection.query(
          "select user_id,title,body,target_path from public.notifications where target_path=$1",
          [`/requests/${first.requestId}`],
        )
      ).rows;
      expect(notices).toHaveLength(1);
      expect(notices[0].user_id).toBe(f.b);
      expect(JSON.stringify(notices)).not.toContain(
        "Synthetic internal document",
      );
      for (const mutation of [
        "source_version_id=gen_random_uuid()",
        "recipient_id=gen_random_uuid()",
        "expires_at=expires_at+interval '1 hour'",
        "sharing_consented_at=sharing_consented_at+interval '1 second'",
        "owner_display_name='Changed'",
      ])
        await denied(
          connection,
          `update public.signing_requests set ${mutation} where id=$1`,
          [first.requestId],
          "P0001",
          "IMMUTABLE_RECORD",
        );
      await denied(
        connection,
        "delete from public.signing_requests where id=$1",
        [first.requestId],
        "P0001",
        "IMMUTABLE_RECORD",
      );
    });
  });

  it("rejects cross-owner source use, mismatched recipient codes, self-invites and obsolete sharing consent", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const source = await draft(connection, f);
      await denied(
        connection,
        "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
        [f.b, randomUUID(), source.version, f.codes[f.c], f.c, sharingPolicy],
        "P0002",
        "SIGNING_NOT_FOUND",
      );
      for (const [recipient, code] of [
        [f.a, f.codes[f.a]],
        [f.b, f.codes[f.c]],
        [f.unverified, f.codes[f.unverified]],
        [f.noUser, f.codes[f.noUser]],
      ])
        await denied(
          connection,
          "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
          [f.a, randomUUID(), source.version, code, recipient, sharingPolicy],
          "P0001",
          "SIGNING_RECIPIENT_UNAVAILABLE",
        );
      await denied(
        connection,
        "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
        [f.a, randomUUID(), source.version, f.codes[f.b], f.b, "outdated"],
        "22023",
        "INVALID_SIGNING_INPUT",
      );
      await denied(
        connection,
        "select public.send_signing_request($1,$2,$3,$4,$5,$6,false)",
        [f.a, randomUUID(), source.version, f.codes[f.b], f.b, sharingPolicy],
        "22023",
        "INVALID_SIGNING_INPUT",
      );
    });
  });

  it("grants source access only to owner and selected recipient, independently of admin/reviewer roles", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const source = await draft(connection, f);
      const unrelated = await draft(connection, f);
      const request = await send(connection, f, source.version);
      for (const id of [f.c, f.admin, f.reviewer]) {
        await actor(connection, "authenticated", id);
        for (const table of [
          "signing_documents",
          "signing_document_versions",
          "signing_requests",
        ])
          expect(
            (await connection.query(`select id from public.${table}`)).rows,
          ).toEqual([]);
      }
      await actor(connection, "authenticated", f.b);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions",
          )
        ).rows,
      ).toEqual([{ id: source.version }]);
      expect(
        (await connection.query("select id from public.signing_documents"))
          .rows,
      ).toEqual([{ id: source.document }]);
      expect(
        (await connection.query("select id from public.signing_requests")).rows,
      ).toEqual([{ id: request.requestId }]);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions where id=$1",
            [unrelated.version],
          )
        ).rows,
      ).toEqual([]);
      await actor(connection, "authenticated", f.a);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions",
          )
        ).rowCount,
      ).toBe(2);
      const ownAdmin = await draft(connection, f, f.admin);
      const adminRequest = await send(
        connection,
        f,
        ownAdmin.version,
        randomUUID(),
        f.admin,
        f.reviewer,
      );
      await actor(connection, "authenticated", f.admin);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions",
          )
        ).rows,
      ).toEqual([{ id: ownAdmin.version }]);
      await actor(connection, "authenticated", f.reviewer);
      expect(
        (await connection.query("select id from public.signing_requests")).rows,
      ).toEqual([{ id: adminRequest.requestId }]);
    });
  });

  it("shares the frozen source version without granting a sibling version of the same document", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const source = await draft(connection, f);
      const sibling = randomUUID();
      await actor(connection, "postgres");
      // Future-version fixture only: the R2 upload RPC itself issues version 1.
      await connection.query(
        `insert into public.signing_document_versions
        select (jsonb_populate_record(null::public.signing_document_versions,
          to_jsonb(v) || jsonb_build_object('id',$2::uuid,'version_no',2,'storage_path',$3::text))).*
        from public.signing_document_versions v where v.id=$1`,
        [
          source.version,
          sibling,
          `${f.a}/signing/${source.document}/${sibling}.pdf`,
        ],
      );
      await send(connection, f, source.version);
      await actor(connection, "authenticated", f.b);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions where document_id=$1",
            [source.document],
          )
        ).rows,
      ).toEqual([{ id: source.version }]);
      await actor(connection, "authenticated", f.a);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions where document_id=$1",
            [source.document],
          )
        ).rowCount,
      ).toBe(2);
    });
  });

  it("cancels once for the owner, revokes recipient PDF, preserves minimal history, and cannot reactivate", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const source = await draft(connection, f);
      const request = await send(connection, f, source.version);
      await denied(
        connection,
        "select public.cancel_signing_request($1,$2)",
        [f.b, request.requestId],
        "P0002",
        "SIGNING_NOT_FOUND",
      );
      const cancelled = await cancel(connection, f.a, request.requestId);
      expect(cancelled.status).toBe("cancelled");
      expect(cancelled.cancelledAt).not.toBeNull();
      expect(await cancel(connection, f.a, request.requestId)).toEqual(
        cancelled,
      );
      expect(
        await send(connection, f, source.version, request.requestId),
      ).toEqual(cancelled);
      await actor(connection, "authenticated", f.b);
      expect(
        (
          await connection.query(
            "select id from public.signing_document_versions",
          )
        ).rows,
      ).toEqual([]);
      expect(
        (await connection.query("select id from public.signing_documents"))
          .rows,
      ).toEqual([]);
      expect(
        (
          await connection.query(
            "select id,status from public.signing_requests",
          )
        ).rows,
      ).toEqual([{ id: request.requestId, status: "cancelled" }]);
      await actor(connection, "postgres");
      expect(
        (
          await connection.query(
            "select action from private.signing_audit_events where request_id=$1 order by id",
            [request.requestId],
          )
        ).rows,
      ).toEqual([{ action: "request_sent" }, { action: "request_cancelled" }]);
      expect(
        (
          await connection.query(
            "select id from public.notifications where target_path=$1",
            [`/requests/${request.requestId}`],
          )
        ).rowCount,
      ).toBe(2);
      await denied(
        connection,
        "update public.signing_requests set status='pending',cancelled_at=null where id=$1",
        [request.requestId],
        "P0001",
        "SIGNING_REQUEST_NOT_ELIGIBLE",
      );
      await actor(connection, "service_role");
      await denied(
        connection,
        "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
        [f.a, randomUUID(), source.version, f.codes[f.c], f.c, sharingPolicy],
        "P0001",
        "SIGNING_DOCUMENT_NOT_ELIGIBLE",
      );
    });
  });

  it.each([
    ["pending", false, "SIGNING_REQUEST_EXPIRED"],
    ["rejected", false, "SIGNING_REQUEST_NOT_ELIGIBLE"],
    ["consented", true, "SIGNING_REQUEST_NOT_ELIGIBLE"],
    ["completed", true, "SIGNING_REQUEST_NOT_ELIGIBLE"],
  ] as const)(
    "enforces %s access after the original expiry while preserving history",
    async (status, readable, cancelError) => {
      await transaction(async (connection) => {
        const f = await fixtures(connection);
        const source = await draft(connection, f);
        const request = await historicalRequest(
          connection,
          f,
          source.document,
          source.version,
          status,
        );
        await actor(connection, "authenticated", f.b);
        expect(
          (
            await connection.query(
              "select id from public.signing_document_versions",
            )
          ).rowCount,
        ).toBe(readable ? 1 : 0);
        expect(
          (await connection.query("select id from public.signing_documents"))
            .rowCount,
        ).toBe(readable ? 1 : 0);
        expect(
          (
            await connection.query(
              "select id,status from public.signing_requests",
            )
          ).rows,
        ).toEqual([{ id: request, status }]);
        await actor(connection, "service_role");
        await denied(
          connection,
          "select public.cancel_signing_request($1,$2)",
          [f.a, request],
          "P0001",
          cancelError,
        );
        await actor(connection, "authenticated", f.a);
        expect(
          (
            await connection.query(
              "select id from public.signing_document_versions",
            )
          ).rowCount,
        ).toBe(1);
      });
    },
  );

  it("enforces composite document-owner-version relations and immutable source/audit rows", async () => {
    await transaction(async (connection) => {
      const f = await fixtures(connection);
      const source = await draft(connection, f);
      const foreign = await draft(connection, f, f.b);
      await actor(connection, "postgres");
      await denied(
        connection,
        "insert into public.signing_requests(id,document_id,source_version_id,owner_id,recipient_id,owner_display_name,recipient_display_name,status,sent_at,expires_at,sharing_policy_version,sharing_consented_at) values ($1,$2,$3,$4,$5,'Owner','Recipient','pending',now(),now()+interval '168 hours',$6,now())",
        [
          randomUUID(),
          source.document,
          foreign.version,
          f.a,
          f.b,
          sharingPolicy,
        ],
        "23503",
      );
      await denied(
        connection,
        "update public.signing_document_versions set source_sha256=$1 where id=$2",
        ["b".repeat(64), source.version],
        "P0001",
        "IMMUTABLE_RECORD",
      );
      await denied(
        connection,
        "delete from public.signing_document_versions where id=$1",
        [source.version],
        "P0001",
        "IMMUTABLE_RECORD",
      );
      await denied(
        connection,
        "update private.signing_audit_events set action='draft_created' where document_id=$1",
        [source.document],
        "P0001",
        "IMMUTABLE_RECORD",
      );
      await denied(
        connection,
        "delete from private.signing_audit_events where document_id=$1",
        [source.document],
        "P0001",
        "IMMUTABLE_RECORD",
      );
    });
  });

  it.each(["anon", "authenticated", "service_role"] as const)(
    "denies %s direct table mutations, truncate and private audit access",
    async (role) => {
      await transaction(async (connection) => {
        const f = await fixtures(connection);
        await actor(connection, role, f.a);
        for (const table of [
          "signing_user_identifiers",
          "signing_documents",
          "signing_document_versions",
          "signing_requests",
        ]) {
          const key = table === "signing_user_identifiers" ? "user_id" : "id";
          await denied(
            connection,
            `insert into public.${table} default values`,
          );
          await denied(connection, `update public.${table} set ${key}=${key}`);
          await denied(connection, `delete from public.${table}`);
          await denied(connection, `truncate public.${table}`);
        }
        await denied(connection, "select * from private.signing_audit_events");
        await denied(connection, "select private.is_signing_user($1)", [f.a]);
        await denied(connection, "select private.signing_request_receipt($1)", [
          randomUUID(),
        ]);
        if (role === "anon")
          await denied(
            connection,
            "select * from public.signing_user_identifiers",
          );
      });
    },
  );

  it.each(["anon", "authenticated"] as const)(
    "denies %s direct RPCs even with forged verified actor IDs and claims",
    async (role) => {
      await transaction(async (connection) => {
        const f = await fixtures(connection);
        const input = await draftArguments(connection, f);
        await actor(connection, role, f.a);
        await connection.query(
          "select set_config('request.jwt.claims',$1,true)",
          [
            JSON.stringify({
              sub: f.a,
              role: "service_role",
              app_metadata: { role: "platform_admin" },
            }),
          ],
        );
        await denied(connection, draftSQL, input.args);
        await denied(
          connection,
          "select public.lookup_signing_recipient($1,$2)",
          [f.a, f.codes[f.b]],
        );
        await denied(
          connection,
          "select public.send_signing_request($1,$2,$3,$4,$5,$6,true)",
          [f.a, randomUUID(), input.version, f.codes[f.b], f.b, sharingPolicy],
        );
        await denied(
          connection,
          "select public.cancel_signing_request($1,$2)",
          [f.a, randomUUID()],
        );
        await denied(
          connection,
          "select public.consume_signing_operation_limit('lookup',$1,$2)",
          [digest(), digest()],
        );
      });
    },
  );

  it("uses definer functions with an empty search path and no anonymous execute grants", async () => {
    const names = [
      "lookup_signing_recipient",
      "create_signing_draft",
      "send_signing_request",
      "cancel_signing_request",
      "consume_signing_operation_limit",
    ];
    const rows = (
      await pool.query(
        "select p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated,has_function_privilege('service_role',p.oid,'execute') as service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1::text[])",
        [names],
      )
    ).rows;
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).toMatchObject({
        prosecdef: true,
        anon: false,
        authenticated: false,
        service: true,
      });
      expect(row.proconfig).toEqual(['search_path=""']);
    }
  });

  it("serializes committed competing sends so only one request/audit/notification wins", async () => {
    const setup = await pool.connect();
    let f: Fixture;
    let source: Awaited<ReturnType<typeof draft>>;
    try {
      await setup.query("begin");
      f = await fixtures(setup);
      source = await draft(setup, f);
      await setup.query("commit");
    } finally {
      setup.release();
    }
    // The isolated cluster is destroyed after the run; these synthetic immutable
    // fixture rows are intentionally not deleted or bypassed via disabled triggers.
    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, async () => {
        const connection = await pool.connect();
        try {
          await connection.query("begin");
          const result = await send(connection, f, source.version);
          await connection.query("commit");
          return result;
        } finally {
          await connection.query("rollback");
          connection.release();
        }
      }),
    );
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    for (const result of attempts)
      if (result.status === "rejected")
        expect((result.reason as Error).message).toBe(
          "SIGNING_DOCUMENT_NOT_ELIGIBLE",
        );
    expect(
      (
        await pool.query(
          "select id from public.signing_requests where document_id=$1",
          [source.document],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "select id from private.signing_audit_events where document_id=$1 and action='request_sent'",
          [source.document],
        )
      ).rowCount,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "select id from public.notifications where user_id=$1 and type='signing_request_received'",
          [f.b],
        )
      ).rowCount,
    ).toBe(1);
  });
});

describe("R2 atomic operation backstop", () => {
  async function consume(
    connection: PoolClient,
    action: string,
    key: string,
    global: string,
  ) {
    return (
      await connection.query<{ allowed: boolean }>(
        "select public.consume_signing_operation_limit($1,$2,$3) as allowed",
        [action, key, global],
      )
    ).rows[0]!.allowed;
  }
  it.each([
    ["lookup", 20, 100],
    ["send", 10, 50],
    ["cancel", 20, 100],
  ] as const)(
    "enforces %s user/global capacity without spending denied attempts",
    async (action, perUser, globalLimit) => {
      await transaction(async (connection) => {
        const key = digest();
        const global = digest();
        await actor(connection, "service_role");
        for (let i = 0; i < perUser; i++)
          expect(await consume(connection, action, key, global)).toBe(true);
        expect(await consume(connection, action, key, global)).toBe(false);
        for (let i = perUser; i < globalLimit; i++)
          expect(await consume(connection, action, digest(), global)).toBe(
            true,
          );
        const blocked = digest();
        expect(await consume(connection, action, blocked, global)).toBe(false);
        await actor(connection, "postgres");
        expect(
          (
            await connection.query(
              "select hits from private.auth_rate_limits where action=$1 and key_digest=$2",
              [`signing_${action}_global`, global],
            )
          ).rows,
        ).toEqual([{ hits: globalLimit }]);
        expect(
          (
            await connection.query(
              "select hits from private.auth_rate_limits where key_digest=$1",
              [blocked],
            )
          ).rows,
        ).toEqual([]);
      });
    },
  );
  it.each([
    [null, digest(), digest()],
    ["other", digest(), digest()],
    ["send", "raw-id", digest()],
    ["lookup", digest(), "A".repeat(64)],
    ["cancel", null, digest()],
  ])(
    "rejects malformed limiter arguments before any mutation",
    async (action, key, global) => {
      await transaction(async (connection) => {
        const stale = digest();
        await connection.query(
          "insert into private.auth_rate_limits values ('signing_send',$1,1,now()-interval '2 days')",
          [stale],
        );
        await actor(connection, "service_role");
        await denied(
          connection,
          "select public.consume_signing_operation_limit($1,$2,$3)",
          [action, key, global],
          "22023",
          "INVALID_SIGNING_INPUT",
        );
        await actor(connection, "postgres");
        expect(
          (
            await connection.query(
              "select hits from private.auth_rate_limits where key_digest=$1",
              [stale],
            )
          ).rows,
        ).toEqual([{ hits: 1 }]);
      });
    },
  );
  it("renews both windows without cleaning unrelated authentication/upload counters", async () => {
    await transaction(async (connection) => {
      const key = digest();
      const global = digest();
      const auth = digest();
      await connection.query(
        "insert into private.auth_rate_limits values ('signing_send',$1,10,now()-interval '16 minutes'),('signing_send_global',$2,50,now()-interval '16 minutes'),('upload',$3,1,now()-interval '2 days')",
        [key, global, auth],
      );
      await actor(connection, "service_role");
      expect(await consume(connection, "send", key, global)).toBe(true);
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
            "select hits from private.auth_rate_limits where key_digest=$1",
            [auth],
          )
        ).rows,
      ).toEqual([{ hits: 1 }]);
    });
  });
  it("bounds a shared user's committed concurrent sends to ten", async () => {
    const key = digest();
    const global = digest();
    const results = await Promise.all(
      Array.from({ length: 16 }, async () => {
        const connection = await pool.connect();
        try {
          await connection.query("begin");
          await actor(connection, "service_role");
          const allowed = await consume(connection, "send", key, global);
          await connection.query("commit");
          return allowed;
        } finally {
          await connection.query("rollback");
          connection.release();
        }
      }),
    );
    expect(results.filter(Boolean)).toHaveLength(10);
  });
});
