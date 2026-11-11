import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_TEST_URL;
if (!databaseUrl || process.env.DVP_DATABASE_TEST_ISOLATED !== "1")
  throw new Error("Run workspace SQL tests through npm run test:db.");
const target = new URL(databaseUrl);
if (target.hostname !== "127.0.0.1" || target.pathname !== "/postgres")
  throw new Error("Workspace SQL tests require the isolated loopback cluster.");
const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  allowExitOnIdle: true,
});
type Role = "postgres" | "authenticated" | "anon" | "service_role";

async function actor(connection: PoolClient, role: Role, user?: string) {
  await connection.query(`set local role ${role}`);
  await connection.query(
    "select set_config('request.jwt.claim.sub', $1, true)",
    [user ?? ""],
  );
  await connection.query("select set_config('request.jwt.claims', $1, true)", [
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
  state = "42501",
) {
  await connection.query("savepoint workspace_denied");
  let failure: unknown;
  try {
    await connection.query(sql, values);
  } catch (error) {
    failure = error;
  } finally {
    await connection.query("rollback to savepoint workspace_denied");
    await connection.query("release savepoint workspace_denied");
  }
  expect(failure).toBeInstanceOf(Error);
  expect((failure as { code?: string }).code).toBe(state);
}
async function fixtures(connection: PoolClient) {
  const a = randomUUID();
  const b = randomUUID();
  const reviewer = randomUUID();
  const empty = randomUUID();
  for (const id of [a, b, reviewer, empty])
    await connection.query(
      'insert into auth.users(id, raw_user_meta_data, email_confirmed_at) values ($1, \'{"full_name":"Synthetic workspace fixture"}\', now())',
      [id],
    );
  await connection.query(
    "insert into public.user_roles(user_id, role) values ($1, 'reviewer')",
    [reviewer],
  );
  const category = (
    await connection.query(
      "select id from public.document_categories where slug = 'pendidikan'",
    )
  ).rows[0].id as string;
  const aDocument = randomUUID();
  const aRejected = randomUUID();
  const bDocument = randomUUID();
  const ownReviewerDocument = randomUUID();
  const versions: {
    document: string;
    owner: string;
    version: number;
    status: string;
    title: string;
  }[] = [
    {
      document: aDocument,
      owner: a,
      version: 1,
      status: "revision_requested",
      title: "Synthetic original title",
    },
    {
      document: aDocument,
      owner: a,
      version: 2,
      status: "pending_review",
      title: "Synthetic current title",
    },
    {
      document: aRejected,
      owner: a,
      version: 1,
      status: "rejected",
      title: "Synthetic rejected",
    },
    {
      document: bDocument,
      owner: b,
      version: 1,
      status: "approved",
      title: "Synthetic foreign title",
    },
    {
      document: ownReviewerDocument,
      owner: reviewer,
      version: 1,
      status: "pending_review",
      title: "Synthetic reviewer-owned title",
    },
  ];
  for (const [document, owner, currentVersion, status] of [
    [aDocument, a, 2, "pending_review"],
    [aRejected, a, 1, "rejected"],
    [bDocument, b, 1, "approved"],
    [ownReviewerDocument, reviewer, 1, "pending_review"],
  ]) {
    await connection.query(
      "insert into public.documents(id, owner_id, current_version_no, current_status, registered_at) values ($1, $2, $3, $4::public.document_status, case when $4 = 'approved' then now() else null end)",
      [document, owner, currentVersion, status],
    );
  }
  let currentSubmission = "";
  for (const version of versions) {
    const id = randomUUID();
    if (version.document === aDocument && version.version === 2)
      currentSubmission = id;
    await connection.query(
      `insert into public.document_submissions
      (id, document_id, submitted_by, version_no, status, title, category_id, original_filename, mime_type, file_size_bytes, sha256, storage_path, policy_version, consented_at)
      values ($1,$2,$3,$4,$5::public.submission_status,$6,$7,'synthetic.pdf','application/pdf',100,$8,$9,'synthetic-test-policy',now())`,
      [
        id,
        version.document,
        version.owner,
        version.version,
        version.status,
        version.title,
        category,
        "a".repeat(64),
        `${version.owner}/${version.document}/${id}.pdf`,
      ],
    );
  }
  return {
    a,
    b,
    reviewer,
    empty,
    category,
    aDocument,
    bDocument,
    currentSubmission,
  };
}

afterAll(async () => {
  await pool.end();
});

describe("Phase 3 owner-only workspace SQL", () => {
  it("uses security-invoker and security-barrier semantics without storage/credential columns", async () => {
    const options = (
      await pool.query(
        "select reloptions from pg_class where oid = 'public.workspace_documents'::regclass",
      )
    ).rows[0].reloptions as string[];
    expect(options).toContain("security_invoker=true");
    expect(options).toContain("security_barrier=true");
    const columns = (
      await pool.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name='workspace_documents'",
      )
    ).rows.map((row) => row.column_name);
    for (const forbidden of [
      "storage_path",
      "storage_bucket",
      "code_digest",
      "reviewer_id",
      "sha256",
    ])
      expect(columns).not.toContain(forbidden);
  });

  it("returns only each user's logical documents and current immutable version", async () => {
    await transaction(async (connection) => {
      const fixture = await fixtures(connection);
      await actor(connection, "authenticated", fixture.a);
      const documents = await connection.query(
        "select id, owner_id, submission_id, title, current_version_no from public.workspace_documents order by id",
      );
      expect(documents.rowCount).toBe(2);
      expect(documents.rows.every((row) => row.owner_id === fixture.a)).toBe(
        true,
      );
      expect(
        documents.rows.find((row) => row.id === fixture.aDocument),
      ).toMatchObject({
        submission_id: fixture.currentSubmission,
        title: "Synthetic current title",
        current_version_no: 2,
      });
      expect(
        (
          await connection.query(
            "select * from public.workspace_documents where id = $1",
            [fixture.bDocument],
          )
        ).rows,
      ).toEqual([]);
      await actor(connection, "authenticated", fixture.b);
      expect(
        (await connection.query("select id from public.workspace_documents"))
          .rows,
      ).toEqual([{ id: fixture.bDocument }]);
    });
  });

  it("does not expand a reviewer's User Workspace to the shared review queue", async () => {
    await transaction(async (connection) => {
      const fixture = await fixtures(connection);
      await actor(connection, "authenticated", fixture.reviewer);
      expect(
        (
          await connection.query(
            "select id from public.documents where id = $1",
            [fixture.aDocument],
          )
        ).rowCount,
      ).toBe(1);
      const own = await connection.query(
        "select owner_id from public.workspace_documents",
      );
      expect(own.rows).toEqual([{ owner_id: fixture.reviewer }]);
      expect(
        (
          await connection.query(
            "select public.get_own_workspace_counts() as counts",
          )
        ).rows[0].counts,
      ).toEqual({
        total: 1,
        pendingReview: 1,
        revisionRequested: 0,
        approved: 0,
        rejected: 0,
        revoked: 0,
      });
    });
  });

  it("counts logical documents once, excludes previous revision statuses, and returns real zeros for a new owner", async () => {
    await transaction(async (connection) => {
      const fixture = await fixtures(connection);
      await actor(connection, "authenticated", fixture.a);
      expect(
        (
          await connection.query(
            "select public.get_own_workspace_counts() as counts",
          )
        ).rows[0].counts,
      ).toEqual({
        total: 2,
        pendingReview: 1,
        revisionRequested: 0,
        approved: 0,
        rejected: 1,
        revoked: 0,
      });
      await actor(connection, "authenticated", fixture.empty);
      expect(
        (
          await connection.query(
            "select public.get_own_workspace_counts() as counts",
          )
        ).rows[0].counts,
      ).toEqual({
        total: 0,
        pendingReview: 0,
        revisionRequested: 0,
        approved: 0,
        rejected: 0,
        revoked: 0,
      });
    });
  });

  it("keeps owned documents visible when their category is inactive without exposing its hidden label", async () => {
    await transaction(async (connection) => {
      const fixture = await fixtures(connection);
      await connection.query(
        "update public.document_categories set is_active = false where id = $1",
        [fixture.category],
      );
      await actor(connection, "authenticated", fixture.a);
      const result = await connection.query(
        "select category_id, category_name, category_slug from public.workspace_documents",
      );
      expect(result.rowCount).toBe(2);
      expect(result.rows).toEqual(
        Array.from({ length: 2 }, () => ({
          category_id: fixture.category,
          category_name: null,
          category_slug: null,
        })),
      );
    });
  });

  it.each(["anon", "service_role"] as const)(
    "denies %s direct workspace view/function use",
    async (role) => {
      await transaction(async (connection) => {
        await actor(connection, role);
        await denied(connection, "select * from public.workspace_documents");
        await denied(connection, "select public.get_own_workspace_counts()");
      });
    },
  );

  it("allows only bounded profile fields for the owner and cannot retarget another profile", async () => {
    await transaction(async (connection) => {
      const fixture = await fixtures(connection);
      await actor(connection, "authenticated", fixture.a);
      expect(
        (
          await connection.query(
            "update public.profiles set full_name = 'Synthetic changed name', phone = null where id = $1 returning full_name, phone",
            [fixture.a],
          )
        ).rows,
      ).toEqual([{ full_name: "Synthetic changed name", phone: null }]);
      expect(
        (
          await connection.query(
            "update public.profiles set full_name = 'Forbidden cross-account change' where id = $1 returning id",
            [fixture.b],
          )
        ).rowCount,
      ).toBe(0);
      await denied(
        connection,
        "update public.profiles set id = $1 where id = $2",
        [fixture.b, fixture.a],
      );
      await denied(
        connection,
        "update public.profiles set created_at = now() where id = $1",
        [fixture.a],
      );
      await denied(
        connection,
        "update public.profiles set full_name = $1 where id = $2",
        ["x".repeat(121), fixture.a],
        "23514",
      );
      await denied(
        connection,
        "update public.profiles set phone = $1 where id = $2",
        ["1".repeat(41), fixture.a],
        "23514",
      );
    });
  });
});
