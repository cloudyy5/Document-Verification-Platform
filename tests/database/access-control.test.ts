import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// This suite accepts only the task-created native PostgreSQL cluster. The
// harness models Supabase system schemas; no Auth/Storage HTTP service is used.
const databaseUrl = process.env.DATABASE_TEST_URL;
if (!databaseUrl || process.env.DVP_DATABASE_TEST_ISOLATED !== "1") {
  throw new Error(
    "Run database tests through npm run test:db (isolated runner).",
  );
}
let localUrl: URL;
try {
  localUrl = new URL(databaseUrl);
} catch {
  throw new Error("The isolated database test configuration is invalid.");
}
if (localUrl.hostname !== "127.0.0.1" || localUrl.pathname !== "/postgres") {
  throw new Error(
    "Database tests may target only the isolated loopback cluster.",
  );
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
  allowExitOnIdle: true,
});

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "10000000-0000-4000-8000-000000000002";
const reviewer = "10000000-0000-4000-8000-000000000003";
const reviewerTwo = "10000000-0000-4000-8000-000000000004";
const administrator = "10000000-0000-4000-8000-000000000005";
const category = "11000000-0000-4000-8000-000000000001";

const documents = {
  aApproved: "20000000-0000-4000-8000-000000000001",
  aPending: "20000000-0000-4000-8000-000000000002",
  bApproved: "20000000-0000-4000-8000-000000000003",
  bPending: "20000000-0000-4000-8000-000000000004",
  bRejected: "20000000-0000-4000-8000-000000000005",
  bRevoked: "20000000-0000-4000-8000-000000000006",
};
const submissions = {
  aApproved: "30000000-0000-4000-8000-000000000001",
  aPending: "30000000-0000-4000-8000-000000000002",
  bApproved: "30000000-0000-4000-8000-000000000003",
  bPendingOld: "30000000-0000-4000-8000-000000000004",
  bPendingCurrent: "30000000-0000-4000-8000-000000000005",
  bRejected: "30000000-0000-4000-8000-000000000006",
  bRevoked: "30000000-0000-4000-8000-000000000007",
};
const allPass = {
  completeness: true,
  readability: true,
  category_match: true,
  registration_eligibility: true,
};

type DatabaseRole = "postgres" | "anon" | "authenticated" | "service_role";

async function actor(
  connection: PoolClient,
  role: DatabaseRole,
  user?: string,
) {
  // role is a closed test-only union, never a request parameter.
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

async function asActor(
  role: DatabaseRole,
  user: string | undefined,
  run: (connection: PoolClient) => Promise<void>,
) {
  await transaction(async (connection) => {
    await actor(connection, role, user);
    await run(connection);
  });
}

async function expectSqlError(
  connection: PoolClient,
  sql: string,
  values: unknown[] = [],
  allowedStates: string[] = ["42501"],
) {
  await connection.query("savepoint expected_denial");
  let failure: unknown;
  try {
    await connection.query(sql, values);
  } catch (error) {
    failure = error;
  } finally {
    await connection.query("rollback to savepoint expected_denial");
    await connection.query("release savepoint expected_denial");
  }
  expect(failure, "The database must reject this operation").toBeInstanceOf(
    Error,
  );
  expect(allowedStates).toContain((failure as { code?: string }).code);
}

async function enableSharedQueue(connection: PoolClient) {
  await connection.query(
    "update private.access_control_settings set shared_review_queue_enabled = true where singleton = true",
  );
}

async function disableSharedQueue(connection: PoolClient) {
  await connection.query(
    "update private.access_control_settings set shared_review_queue_enabled = false where singleton = true",
  );
}

async function insertDocument(
  connection: PoolClient,
  id: string,
  owner: string,
  status: "pending_review" | "approved" | "rejected" | "revoked",
  version = 1,
) {
  await connection.query(
    `insert into public.documents
       (id, owner_id, current_version_no, current_status, registered_at,
        revoked_at, revoked_by, revocation_reason)
     values ($1, $2, $3, $4::public.document_status,
       case when $4 in ('approved', 'revoked') then now() else null end,
       case when $4 = 'revoked' then now() else null end,
       case when $4 = 'revoked' then $5::uuid else null end,
       case when $4 = 'revoked' then 'Synthetic database fixture' else null end)`,
    [id, owner, version, status, administrator],
  );
}

async function insertSubmission(
  connection: PoolClient,
  id: string,
  document: string,
  owner: string,
  status: "pending_review" | "approved" | "rejected" | "revision_requested",
  version = 1,
) {
  await connection.query(
    `insert into public.document_submissions
       (id, document_id, version_no, status, submitted_by, title, category_id,
        original_filename, mime_type, file_size_bytes, sha256, storage_path,
        policy_version, consented_at, submitter_display_name)
     values ($1, $2, $3, $4::public.submission_status, $5, 'Synthetic SQL fixture',
       $6, 'synthetic.pdf', 'application/pdf', 123, $7, $8, 'test-only', now(), 'Synthetic owner')`,
    [
      id,
      document,
      version,
      status,
      owner,
      category,
      "a".repeat(64),
      `${owner}/${document}/${version}.pdf`,
    ],
  );
}

async function insertDecision(
  connection: PoolClient,
  submission: string,
  reviewerId: string,
  decision = "approved",
  checklist: unknown = allPass,
  note: string | null = null,
) {
  await connection.query(
    `insert into public.review_decisions
       (submission_id, reviewer_id, decision, checklist, decision_note)
     values ($1, $2, $3::public.review_decision_type, $4::jsonb, $5)`,
    [submission, reviewerId, decision, JSON.stringify(checklist), note],
  );
}

beforeAll(async () => {
  const connection = await pool.connect();
  try {
    await connection.query("begin");
    for (const [id, fullName] of [
      [userA, "Synthetic Owner A"],
      [userB, "Synthetic Owner B"],
      [reviewer, "Synthetic Reviewer"],
      [reviewerTwo, "Synthetic Reviewer Two"],
      [administrator, "Synthetic Administrator"],
    ]) {
      await connection.query(
        "insert into auth.users (id, raw_user_meta_data, email_confirmed_at) values ($1, $2::jsonb, now())",
        [
          id,
          JSON.stringify({
            full_name: fullName,
            role: "platform_admin",
            roles: ["reviewer"],
          }),
        ],
      );
    }
    await connection.query(
      `insert into public.user_roles (user_id, role) values
       ($1, 'reviewer'), ($2, 'reviewer'), ($3, 'platform_admin')`,
      [reviewer, reviewerTwo, administrator],
    );
    await connection.query(
      "insert into public.document_categories (id, name, slug, is_active) values ($1, 'Synthetic test category', 'synthetic-test', true)",
      [category],
    );
    await insertDocument(connection, documents.aApproved, userA, "approved");
    await insertDocument(
      connection,
      documents.aPending,
      userA,
      "pending_review",
    );
    await insertDocument(connection, documents.bApproved, userB, "approved");
    await insertDocument(
      connection,
      documents.bPending,
      userB,
      "pending_review",
      2,
    );
    await insertDocument(connection, documents.bRejected, userB, "rejected");
    await insertDocument(connection, documents.bRevoked, userB, "revoked");
    await insertSubmission(
      connection,
      submissions.aApproved,
      documents.aApproved,
      userA,
      "approved",
    );
    await insertSubmission(
      connection,
      submissions.aPending,
      documents.aPending,
      userA,
      "pending_review",
    );
    await insertSubmission(
      connection,
      submissions.bApproved,
      documents.bApproved,
      userB,
      "approved",
    );
    await insertSubmission(
      connection,
      submissions.bPendingOld,
      documents.bPending,
      userB,
      "revision_requested",
    );
    await insertSubmission(
      connection,
      submissions.bPendingCurrent,
      documents.bPending,
      userB,
      "pending_review",
      2,
    );
    await insertSubmission(
      connection,
      submissions.bRejected,
      documents.bRejected,
      userB,
      "rejected",
    );
    await insertSubmission(
      connection,
      submissions.bRevoked,
      documents.bRevoked,
      userB,
      "approved",
    );
    await insertDecision(connection, submissions.aApproved, reviewer);
    await insertDecision(connection, submissions.bApproved, reviewerTwo);
    await connection.query(
      `insert into public.verification_credentials (document_id, code_digest)
       values ($1, $3), ($2, $4)`,
      [
        documents.aApproved,
        documents.bApproved,
        "b".repeat(64),
        "c".repeat(64),
      ],
    );
    for (const owner of [userA, userB]) {
      await connection.query(
        `insert into public.notifications (user_id, type, title, body)
         values ($1, 'synthetic_test', 'Synthetic notice', 'Database test fixture only')`,
        [owner],
      );
      await connection.query(
        "insert into public.verification_events (user_id, method, result) values ($1, 'hash', 'no_match')",
        [owner],
      );
      await connection.query(
        "insert into public.audit_logs (actor_user_id, action) values ($1, 'synthetic.fixture')",
        [owner],
      );
    }
    await connection.query(
      "insert into storage.objects (bucket_id, name) values ('document-submissions', $1)",
      [`${userA}/fixture.pdf`],
    );
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }
});

afterAll(async () => {
  await pool.end();
});

const publicTables = [
  "profiles",
  "user_roles",
  "document_categories",
  "documents",
  "document_submissions",
  "review_decisions",
  "verification_credentials",
  "notifications",
  "audit_logs",
  "verification_events",
] as const;

describe("schema and anonymous access", () => {
  it.each(publicTables)("enables RLS on public.%s", async (table) => {
    const result = await pool.query(
      "select relrowsecurity from pg_class where oid = $1::regclass",
      [`public.${table}`],
    );
    expect(result.rows).toEqual([{ relrowsecurity: true }]);
  });

  it.each(publicTables)(
    "denies anonymous SELECT on public.%s",
    async (table) => {
      await asActor("anon", undefined, async (connection) => {
        await expectSqlError(connection, `select * from public.${table}`);
      });
    },
  );

  it("creates only the ordinary user role even if signup metadata claims privilege", async () => {
    const result = await pool.query(
      "select role from public.user_roles where user_id = $1 order by role",
      [userA],
    );
    expect(result.rows).toEqual([{ role: "user" }]);
    const profile = await pool.query(
      "select full_name from public.profiles where id = $1",
      [userA],
    );
    expect(profile.rows).toEqual([{ full_name: "Synthetic Owner A" }]);
  });

  it("activates the nine categories explicitly approved by the owner", async () => {
    const result = await pool.query(
      `select slug, is_active from public.document_categories where slug in
       ('pendidikan','pekerjaan','organisasi','administrasi','keuangan','kesehatan','hukum','pribadi','lainnya')`,
    );
    expect(result.rows).toHaveLength(9);
    expect(result.rows.every((row) => row.is_active === true)).toBe(true);
  });

  it("does not make newly inserted categories active by default", async () => {
    await transaction(async (connection) => {
      const result = await connection.query(
        "insert into public.document_categories (name, slug) values ('Synthetic inactive', 'synthetic-inactive') returning is_active",
      );
      expect(result.rows).toEqual([{ is_active: false }]);
    });
  });
});

describe("owner isolation", () => {
  it.each([userA, userB])(
    "limits document reads to the authenticated owner %s",
    async (owner) => {
      await asActor("authenticated", owner, async (connection) => {
        const result = await connection.query(
          "select owner_id from public.documents",
        );
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows.every((row) => row.owner_id === owner)).toBe(true);
      });
    },
  );

  it.each([userA, userB])(
    "limits submission reads to the authenticated owner %s",
    async (owner) => {
      await asActor("authenticated", owner, async (connection) => {
        const result = await connection.query(
          "select submitted_by from public.document_submissions",
        );
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows.every((row) => row.submitted_by === owner)).toBe(
          true,
        );
      });
    },
  );

  it.each([userA, userB])(
    "returns only the owner's profiles, roles, notifications, and events %s",
    async (owner) => {
      await asActor("authenticated", owner, async (connection) => {
        for (const [table, column] of [
          ["profiles", "id"],
          ["user_roles", "user_id"],
          ["notifications", "user_id"],
          ["verification_events", "user_id"],
        ]) {
          const result = await connection.query(
            `select ${column} as owner from public.${table}`,
          );
          expect(result.rows.length, table).toBeGreaterThan(0);
          expect(
            result.rows.every((row) => row.owner === owner),
            table,
          ).toBe(true);
        }
      });
    },
  );

  it.each([
    [userA, submissions.aApproved],
    [userB, submissions.bApproved],
  ])(
    "returns only the owner's review decision %s",
    async (owner, submission) => {
      await asActor("authenticated", owner, async (connection) => {
        const result = await connection.query(
          "select submission_id from public.review_decisions",
        );
        expect(result.rows).toEqual([{ submission_id: submission }]);
      });
    },
  );

  it.each(["verification_credentials", "audit_logs"])(
    "keeps %s server-only even for its owner",
    async (table) => {
      await asActor("authenticated", userA, async (connection) => {
        await expectSqlError(connection, `select * from public.${table}`);
      });
    },
  );

  it("does not trust the role value in unverified JWT metadata", async () => {
    await asActor("authenticated", userA, async (connection) => {
      await connection.query(
        "select set_config('request.jwt.claims', $1, true)",
        [
          JSON.stringify({
            sub: userA,
            role: "platform_admin",
            user_metadata: { role: "reviewer" },
          }),
        ],
      );
      const result = await connection.query(
        "select * from public.documents where owner_id = $1",
        [userB],
      );
      expect(result.rowCount).toBe(0);
      expect(
        (
          await connection.query(
            "select private.has_role('reviewer') as elevated",
          )
        ).rows,
      ).toEqual([{ elevated: false }]);
    });
  });
});

const noClientMutation = publicTables.filter(
  (table) => table !== "profiles" && table !== "notifications",
);
const clientRoles = ["anon", "authenticated"] as const;

describe.each(clientRoles)("%s cannot mutate application state", (role) => {
  it.each(publicTables)("denies INSERT into %s", async (table) => {
    await asActor(
      role,
      role === "authenticated" ? userA : undefined,
      async (connection) => {
        await expectSqlError(
          connection,
          `insert into public.${table} default values`,
        );
      },
    );
  });

  it.each(publicTables)("denies DELETE from %s", async (table) => {
    await asActor(
      role,
      role === "authenticated" ? userA : undefined,
      async (connection) => {
        await expectSqlError(connection, `delete from public.${table}`);
      },
    );
  });

  it.each(publicTables)(
    "denies TRUNCATE of %s even though TRUNCATE is not controlled by RLS",
    async (table) => {
      await asActor(
        role,
        role === "authenticated" ? userA : undefined,
        async (connection) => {
          await expectSqlError(connection, `truncate public.${table} cascade`);
        },
      );
    },
  );

  it.each(noClientMutation)(
    "denies direct state UPDATE of %s",
    async (table) => {
      await asActor(
        role,
        role === "authenticated" ? userA : undefined,
        async (connection) => {
          const column =
            table === "user_roles"
              ? "role"
              : table === "review_decisions"
                ? "decision"
                : table === "document_categories"
                  ? "name"
                  : table === "document_submissions"
                    ? "title"
                    : table === "documents"
                      ? "current_status"
                      : table === "audit_logs"
                        ? "action"
                        : table === "verification_events"
                          ? "result"
                          : "key_version";
          await expectSqlError(
            connection,
            `update public.${table} set ${column} = ${column}`,
          );
        },
      );
    },
  );

  it("denies changing the private reviewer-access policy", async () => {
    await asActor(
      role,
      role === "authenticated" ? userA : undefined,
      async (connection) => {
        await expectSqlError(
          connection,
          "update private.access_control_settings set shared_review_queue_enabled = true",
        );
      },
    );
  });
});

describe("limited owner updates", () => {
  it("allows the owner to update only public profile preference columns", async () => {
    await asActor("authenticated", userA, async (connection) => {
      const result = await connection.query(
        "update public.profiles set full_name = 'Updated synthetic name', phone = 'test-phone', avatar_path = null where id = $1 returning full_name",
        [userA],
      );
      expect(result.rows).toEqual([{ full_name: "Updated synthetic name" }]);
      const foreign = await connection.query(
        "update public.profiles set full_name = 'Attempted cross-account update' where id = $1",
        [userB],
      );
      expect(foreign.rowCount).toBe(0);
    });
  });

  it.each(["id", "created_at", "updated_at"])(
    "denies updating protected profile field %s",
    async (column) => {
      await asActor("authenticated", userA, async (connection) => {
        await expectSqlError(
          connection,
          `update public.profiles set ${column} = ${column} where id = $1`,
          [userA],
        );
      });
    },
  );

  it("lets an owner mark only their own notification as read", async () => {
    await asActor("authenticated", userA, async (connection) => {
      const own = await connection.query(
        "update public.notifications set read_at = now() where user_id = $1 returning read_at",
        [userA],
      );
      expect(own.rowCount).toBe(1);
      expect(own.rows[0].read_at).not.toBeNull();
      const foreign = await connection.query(
        "update public.notifications set read_at = now() where user_id = $1",
        [userB],
      );
      expect(foreign.rowCount).toBe(0);
    });
  });

  it.each(["user_id", "title", "body", "target_path", "type", "created_at"])(
    "denies rewriting notification field %s",
    async (column) => {
      await asActor("authenticated", userA, async (connection) => {
        await expectSqlError(
          connection,
          `update public.notifications set ${column} = ${column} where user_id = $1`,
          [userA],
        );
      });
    },
  );

  it.each(["profiles", "notifications"])(
    "does not allow anonymous updates to %s",
    async (table) => {
      await asActor("anon", undefined, async (connection) => {
        const field = table === "profiles" ? "full_name" : "read_at";
        await expectSqlError(
          connection,
          `update public.${table} set ${field} = ${field}`,
        );
      });
    },
  );
});

describe("privileged role boundaries", () => {
  it("reserves role mutations for the trusted operator rather than the service client", async () => {
    await asActor("service_role", undefined, async (connection) => {
      await expectSqlError(
        connection,
        "insert into public.user_roles (user_id, role, granted_by) values ($1, 'reviewer', $2)",
        [userA, administrator],
      );
      await expectSqlError(
        connection,
        "update public.user_roles set granted_by = $2 where user_id = $1",
        [userA, administrator],
      );
      await expectSqlError(
        connection,
        "update public.user_roles set role = 'reviewer' where user_id = $1 and role = 'user'",
        [userA],
      );
      await expectSqlError(
        connection,
        "delete from public.user_roles where user_id = $1",
        [userA],
      );
    });
  });

  it("limits platform-admin client role inspection to its own account", async () => {
    await asActor("authenticated", administrator, async (connection) => {
      const result = await connection.query(
        "select user_id, role from public.user_roles order by role",
      );
      expect(result.rows).toEqual([
        { user_id: administrator, role: "user" },
        { user_id: administrator, role: "platform_admin" },
      ]);
      expect(
        (
          await connection.query(
            "select user_id from public.user_roles where user_id = $1",
            [userA],
          )
        ).rowCount,
      ).toBe(0);
    });
  });

  it("retains server-side role inspection for the trusted service", async () => {
    await asActor("service_role", undefined, async (connection) => {
      const result = await connection.query(
        "select user_id, role from public.user_roles where user_id in ($1, $2) order by user_id",
        [userA, userB],
      );
      expect(result.rows).toEqual([
        { user_id: userA, role: "user" },
        { user_id: userB, role: "user" },
      ]);
    });
  });

  it("enables the shared reviewer queue after explicit owner approval", async () => {
    const config = await pool.query(
      "select shared_review_queue_enabled from private.access_control_settings where singleton = true",
    );
    expect(config.rows).toEqual([{ shared_review_queue_enabled: true }]);
    await asActor("authenticated", reviewer, async (connection) => {
      expect(
        (await connection.query("select id from public.documents")).rowCount,
      ).toBe(2);
      expect(
        (await connection.query("select id from public.document_submissions"))
          .rowCount,
      ).toBe(2);
    });
  });

  it("removes foreign reviewer access when the operator disables shared scope", async () => {
    await transaction(async (connection) => {
      await disableSharedQueue(connection);
      await actor(connection, "authenticated", reviewer);
      expect(
        (await connection.query("select id from public.documents")).rowCount,
      ).toBe(0);
      expect(
        (await connection.query("select id from public.document_submissions"))
          .rowCount,
      ).toBe(0);
    });
  });

  it("allows a deliberately enabled shared queue to reveal only pending current versions", async () => {
    await transaction(async (connection) => {
      await enableSharedQueue(connection);
      await actor(connection, "authenticated", reviewer);
      const visibleDocuments = await connection.query(
        "select id from public.documents order by id",
      );
      expect(visibleDocuments.rows.map((row) => row.id)).toEqual([
        documents.aPending,
        documents.bPending,
      ]);
      const visibleSubmissions = await connection.query(
        "select id from public.document_submissions order by id",
      );
      expect(visibleSubmissions.rows.map((row) => row.id)).toEqual([
        submissions.aPending,
        submissions.bPendingCurrent,
      ]);
    });
  });

  it("restricts reviewer history to decisions made by that reviewer", async () => {
    await asActor("authenticated", reviewer, async (connection) => {
      const history = await connection.query(
        "select reviewer_id, submission_id from public.review_decisions",
      );
      expect(history.rows).toEqual([
        { reviewer_id: reviewer, submission_id: submissions.aApproved },
      ]);
    });
  });

  it("does not grant platform admins private document or reviewer access", async () => {
    await transaction(async (connection) => {
      await enableSharedQueue(connection);
      await actor(connection, "authenticated", administrator);
      for (const table of [
        "documents",
        "document_submissions",
        "review_decisions",
      ]) {
        expect(
          (await connection.query(`select * from public.${table}`)).rowCount,
          table,
        ).toBe(0);
      }
      await expectSqlError(
        connection,
        "insert into public.user_roles (user_id, role) values ($1, 'reviewer')",
        [administrator],
      );
      await expectSqlError(
        connection,
        "update private.access_control_settings set shared_review_queue_enabled = true",
      );
    });
  });

  it("still allows reviewer accounts to read their own document through owner policy", async () => {
    await transaction(async (connection) => {
      const id = randomUUID();
      await insertDocument(connection, id, reviewer, "approved");
      await insertSubmission(
        connection,
        randomUUID(),
        id,
        reviewer,
        "approved",
      );
      await disableSharedQueue(connection);
      await actor(connection, "authenticated", reviewer);
      const result = await connection.query("select id from public.documents");
      expect(result.rows).toEqual([{ id }]);
    });
  });
});

const workflowCalls = [
  [
    "create_document_submission",
    "select public.create_document_submission(null::uuid,null::uuid,null::uuid,null::text,null::uuid,null::text,null::date,null::text,null::text,null::text,null::bigint,null::text,null::text,null::text,null::boolean)",
  ],
  [
    "create_document_resubmission",
    "select public.create_document_resubmission(null::uuid,null::uuid,null::uuid,null::text,null::uuid,null::text,null::date,null::text,null::text,null::text,null::bigint,null::text,null::text,null::text,null::boolean)",
  ],
  [
    "apply_review_decision",
    "select public.apply_review_decision(null::uuid,null::uuid,null::public.review_decision_type,null::jsonb,null::text,null::uuid,null::text,null::smallint)",
  ],
] as const;

describe.each(clientRoles)(
  "%s cannot invoke trusted-server workflow RPCs",
  (role) => {
    it.each(workflowCalls)("rejects %s", async (_name, sql) => {
      await asActor(
        role,
        role === "authenticated" ? userA : undefined,
        async (connection) => {
          await expectSqlError(connection, sql);
        },
      );
    });
  },
);

describe("trusted-server database operations", () => {
  it("creates an initial pending submission without issuing a verification credential", async () => {
    await transaction(async (connection) => {
      const documentId = randomUUID();
      const submissionId = randomUUID();
      const storagePath = `${userA}/${documentId}/initial.pdf`;
      await connection.query(
        "insert into storage.objects (bucket_id, name) values ('document-submissions', $1)",
        [storagePath],
      );
      await actor(connection, "service_role");
      const result = await connection.query(
        `select public.create_document_submission(
          $1::uuid,$2::uuid,$3::uuid,'Synthetic RPC submission',$4::uuid,
          null::text,null::date,null::text,null::text,'synthetic.pdf',
          123::bigint,$5::text,$6::text,'test-policy',true) as submission`,
        [
          userA,
          documentId,
          submissionId,
          category,
          "a".repeat(64),
          storagePath,
        ],
      );
      expect(result.rows[0].submission).toMatchObject({
        documentId,
        submissionId,
        versionNo: 1,
        status: "pending_review",
      });
      expect(
        (
          await connection.query(
            "select id from public.verification_credentials where document_id = $1",
            [documentId],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await connection.query(
            "select action from public.audit_logs where resource_id = $1",
            [documentId],
          )
        ).rows,
      ).toEqual([{ action: "document.submitted" }]);
    });
  });

  it("allows service-scoped reads and audited inserts without granting public access", async () => {
    await asActor("service_role", undefined, async (connection) => {
      expect(
        (await connection.query("select id from public.documents")).rowCount,
      ).toBe(6);
      const result = await connection.query(
        "insert into public.audit_logs (action, actor_user_id) values ('synthetic.service.test', $1) returning id",
        [userA],
      );
      expect(result.rowCount).toBe(1);
      expect(Number(result.rows[0].id)).toBeGreaterThan(0);
    });
  });

  it("rejects review RPC calls while the operator disables shared reviewer scope", async () => {
    await transaction(async (connection) => {
      await disableSharedQueue(connection);
      await actor(connection, "service_role");
      await expectSqlError(
        connection,
        "select public.apply_review_decision($1::uuid,$2::uuid,'approved',$3::jsonb,null,$4::uuid,$5::text,1::smallint)",
        [
          reviewer,
          submissions.aPending,
          JSON.stringify(allPass),
          randomUUID(),
          "d".repeat(64),
        ],
      );
      expect(
        (
          await connection.query(
            "select current_status from public.documents where id = $1",
            [documents.aPending],
          )
        ).rows,
      ).toEqual([{ current_status: "pending_review" }]);
      expect(
        (
          await connection.query(
            "select id from public.verification_credentials where document_id = $1",
            [documents.aPending],
          )
        ).rowCount,
      ).toBe(0);
    });
  });

  it("can apply an approved review atomically only after operator-scoped policy enablement", async () => {
    await transaction(async (connection) => {
      await enableSharedQueue(connection);
      await actor(connection, "service_role");
      const credentialId = randomUUID();
      const result = await connection.query(
        "select public.apply_review_decision($1::uuid,$2::uuid,'approved',$3::jsonb,null,$4::uuid,$5::text,1::smallint) as decision",
        [
          reviewer,
          submissions.aPending,
          JSON.stringify(allPass),
          credentialId,
          "d".repeat(64),
        ],
      );
      expect(result.rows[0].decision).toMatchObject({
        documentId: documents.aPending,
        submissionId: submissions.aPending,
        status: "approved",
      });
      const record = await connection.query(
        `select d.current_status, s.status, d.registered_at, c.id as credential_id
         from public.documents d join public.document_submissions s on s.document_id = d.id
         join public.verification_credentials c on c.document_id = d.id where d.id = $1`,
        [documents.aPending],
      );
      expect(record.rowCount).toBe(1);
      expect(record.rows[0]).toMatchObject({
        current_status: "approved",
        status: "approved",
        credential_id: credentialId,
      });
      expect(record.rows[0].registered_at).not.toBeNull();
      expect(
        (
          await connection.query(
            "select submission_id from public.review_decisions where submission_id = $1",
            [submissions.aPending],
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await connection.query(
            "select id from public.audit_logs where action = 'review.approved' and resource_id = $1",
            [submissions.aPending],
          )
        ).rowCount,
      ).toBe(1);
      expect(
        (
          await connection.query(
            "select id from public.notifications where type = 'review_approved' and user_id = $1",
            [userA],
          )
        ).rowCount,
      ).toBe(1);
    });
  });

  it("rolls back the entire review if credential creation fails", async () => {
    await transaction(async (connection) => {
      await enableSharedQueue(connection);
      await actor(connection, "service_role");
      // The digest already belongs to another approved fixture. A unique-key
      // failure occurs after status and decision writes inside the RPC.
      await expectSqlError(
        connection,
        "select public.apply_review_decision($1::uuid,$2::uuid,'approved',$3::jsonb,null,$4::uuid,$5::text,1::smallint)",
        [
          reviewer,
          submissions.aPending,
          JSON.stringify(allPass),
          randomUUID(),
          "b".repeat(64),
        ],
        ["23505"],
      );
      expect(
        (
          await connection.query(
            "select current_status from public.documents where id = $1",
            [documents.aPending],
          )
        ).rows,
      ).toEqual([{ current_status: "pending_review" }]);
      expect(
        (
          await connection.query(
            "select status from public.document_submissions where id = $1",
            [submissions.aPending],
          )
        ).rows,
      ).toEqual([{ status: "pending_review" }]);
      expect(
        (
          await connection.query(
            "select submission_id from public.review_decisions where submission_id = $1",
            [submissions.aPending],
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await connection.query(
            "select id from public.verification_credentials where document_id = $1",
            [documents.aPending],
          )
        ).rowCount,
      ).toBe(0);
    });
  });

  it("does not allow a second reviewer to overwrite an existing decision", async () => {
    await transaction(async (connection) => {
      await enableSharedQueue(connection);
      await actor(connection, "service_role");
      await expectSqlError(
        connection,
        "select public.apply_review_decision($1::uuid,$2::uuid,'approved',$3::jsonb,null,$4::uuid,$5::text,1::smallint)",
        [
          reviewerTwo,
          submissions.aApproved,
          JSON.stringify(allPass),
          randomUUID(),
          "d".repeat(64),
        ],
        ["P0001"],
      );
      expect(
        (
          await connection.query(
            "select reviewer_id from public.review_decisions where submission_id = $1",
            [submissions.aApproved],
          )
        ).rows,
      ).toEqual([{ reviewer_id: reviewer }]);
    });
  });
});

describe("storage remains server-only", () => {
  it("creates the document bucket privately with a PDF MIME restriction", async () => {
    const result = await pool.query(
      "select public, allowed_mime_types from storage.buckets where id = 'document-submissions'",
    );
    expect(result.rows).toEqual([
      { public: false, allowed_mime_types: ["application/pdf"] },
    ]);
  });

  it.each(clientRoles)(
    "denies %s even if a permissive storage policy is later added",
    async (role) => {
      await transaction(async (connection) => {
        await connection.query(
          "create policy synthetic_permissive_objects on storage.objects for all to anon, authenticated using (true) with check (true)",
        );
        await connection.query(
          "create policy synthetic_permissive_buckets on storage.buckets for all to anon, authenticated using (true) with check (true)",
        );
        await connection.query(
          "insert into storage.buckets (id, name, public) values ('synthetic-unrelated', 'synthetic-unrelated', false)",
        );
        await connection.query(
          "insert into storage.objects (bucket_id, name) values ('synthetic-unrelated', 'unrelated.txt')",
        );
        await actor(
          connection,
          role,
          role === "authenticated" ? userA : undefined,
        );
        expect(
          (
            await connection.query(
              "select * from storage.objects where bucket_id = 'document-submissions'",
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await connection.query(
              "select * from storage.buckets where id = 'document-submissions'",
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await connection.query(
              "select * from storage.objects where bucket_id = 'synthetic-unrelated'",
            )
          ).rowCount,
        ).toBe(1);
        await expectSqlError(
          connection,
          "insert into storage.objects (bucket_id, name) values ('document-submissions', 'attempt.pdf')",
        );
        expect(
          (
            await connection.query(
              "update storage.objects set name = 'replaced.pdf' where bucket_id = 'document-submissions'",
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await connection.query(
              "delete from storage.objects where bucket_id = 'document-submissions'",
            )
          ).rowCount,
        ).toBe(0);
        expect(
          (
            await connection.query(
              "update storage.buckets set public = true where id = 'document-submissions'",
            )
          ).rowCount,
        ).toBe(0);
      });
    },
  );
});

describe("immutable history and approval constraints", () => {
  it("rejects a submission whose submitter differs from the parent document owner", async () => {
    await transaction(async (connection) => {
      const documentId = randomUUID();
      await insertDocument(connection, documentId, userA, "pending_review");
      await expectSqlError(
        connection,
        `insert into public.document_submissions
         (id, document_id, version_no, status, submitted_by, title, category_id,
          original_filename, mime_type, file_size_bytes, sha256, storage_path,
          policy_version, consented_at)
         values ($1,$2,1,'pending_review',$3,'Synthetic mismatched owner',$4,
          'synthetic.pdf','application/pdf',123,$5,$6,'test-only',now())`,
        [
          randomUUID(),
          documentId,
          userB,
          category,
          "a".repeat(64),
          `${userB}/${documentId}/wrong-owner.pdf`,
        ],
        ["23503"],
      );
    });
  });

  it("requires a document's declared current version to exist by transaction completion", async () => {
    await transaction(async (connection) => {
      await insertDocument(connection, randomUUID(), userA, "pending_review");
      await expectSqlError(
        connection,
        "set constraints all immediate",
        [],
        ["23503"],
      );
    });
  });

  it.each(["review_decisions", "audit_logs"])(
    "prevents even trusted-server rewrites of %s",
    async (table) => {
      await asActor("service_role", undefined, async (connection) => {
        const column =
          table === "review_decisions" ? "decision_note" : "action";
        await expectSqlError(
          connection,
          `update public.${table} set ${column} = 'tampered'`,
        );
        await expectSqlError(connection, `delete from public.${table}`);
        await expectSqlError(connection, `truncate public.${table} cascade`);
      });
    },
  );

  it.each([
    "title",
    "sha256",
    "storage_path",
    "document_id",
    "submitted_by",
    "consented_at",
  ])("prevents rewriting immutable submission field %s", async (column) => {
    await asActor("service_role", undefined, async (connection) => {
      const value =
        column === "title"
          ? "'Altered title'"
          : column === "sha256"
            ? `'${"f".repeat(64)}'`
            : column === "storage_path"
              ? `'${userA}/replacement.pdf'`
              : column === "document_id"
                ? `'${documents.bPending}'::uuid`
                : column === "submitted_by"
                  ? `'${userB}'::uuid`
                  : "now() + interval '1 hour'";
      await expectSqlError(
        connection,
        `update public.document_submissions set ${column} = ${value} where id = $1`,
        [submissions.aPending],
      );
    });
  });

  it.each(["review_decisions", "audit_logs"])(
    "also blocks SQL-operator UPDATE and DELETE of immutable %s",
    async (table) => {
      await transaction(async (connection) => {
        const column =
          table === "review_decisions" ? "decision_note" : "action";
        await expectSqlError(
          connection,
          `update public.${table} set ${column} = 'tampered'`,
          [],
          ["P0001"],
        );
        await expectSqlError(
          connection,
          `delete from public.${table}`,
          [],
          ["P0001"],
        );
      });
    },
  );

  it("preserves submission metadata even against an accidental SQL-operator update", async () => {
    await transaction(async (connection) => {
      await expectSqlError(
        connection,
        "update public.document_submissions set title = 'Altered file metadata' where id = $1",
        [submissions.aPending],
        ["P0001"],
      );
    });
  });

  it("cannot issue a credential for a pending document", async () => {
    await asActor("service_role", undefined, async (connection) => {
      await expectSqlError(
        connection,
        "insert into public.verification_credentials (document_id, code_digest) values ($1, $2)",
        [documents.aPending, "d".repeat(64)],
        ["P0001", "23514"],
      );
    });
  });

  it("cannot issue a credential if the current approved document points to an unapproved submission", async () => {
    await transaction(async (connection) => {
      const id = randomUUID();
      await insertDocument(connection, id, userA, "approved");
      await insertSubmission(
        connection,
        randomUUID(),
        id,
        userA,
        "pending_review",
      );
      await actor(connection, "service_role");
      await expectSqlError(
        connection,
        "insert into public.verification_credentials (document_id, code_digest) values ($1, $2)",
        [id, "e".repeat(64)],
        ["P0001", "23514"],
      );
    });
  });

  it.each([
    ["missing keys", {}],
    [
      "one missing key",
      { completeness: true, readability: true, category_match: true },
    ],
    ["JSON null", null],
    ["null checklist member", { ...allPass, readability: null }],
    ["string boolean", { ...allPass, readability: "true" }],
    ["additional criterion", { ...allPass, legal_authenticity: true }],
    ["array", [true, true, true, true]],
  ])("rejects a review checklist with %s", async (_description, checklist) => {
    await asActor("service_role", undefined, async (connection) => {
      await expectSqlError(
        connection,
        "insert into public.review_decisions (submission_id, reviewer_id, decision, checklist) values ($1, $2, 'approved', $3::jsonb)",
        [submissions.aPending, reviewer, JSON.stringify(checklist)],
        ["23514", "23502", "22023", "P0001"],
      );
    });
  });

  it("rejects an approval if any required administrative check failed", async () => {
    await asActor("service_role", undefined, async (connection) => {
      await expectSqlError(
        connection,
        "insert into public.review_decisions (submission_id, reviewer_id, decision, checklist) values ($1, $2, 'approved', $3::jsonb)",
        [
          submissions.aPending,
          reviewer,
          JSON.stringify({ ...allPass, readability: false }),
        ],
        ["23514"],
      );
    });
  });

  it.each(["rejected", "revision_requested"])(
    "requires a note and at least one failed criterion for %s",
    async (decision) => {
      await asActor("service_role", undefined, async (connection) => {
        await expectSqlError(
          connection,
          "insert into public.review_decisions (submission_id, reviewer_id, decision, checklist, decision_note) values ($1, $2, $3::public.review_decision_type, $4::jsonb, null)",
          [
            submissions.aPending,
            reviewer,
            decision,
            JSON.stringify({ ...allPass, readability: false }),
          ],
          ["23514"],
        );
        await expectSqlError(
          connection,
          "insert into public.review_decisions (submission_id, reviewer_id, decision, checklist, decision_note) values ($1, $2, $3::public.review_decision_type, $4::jsonb, 'Needs changes')",
          [submissions.aPending, reviewer, decision, JSON.stringify(allPass)],
          ["23514"],
        );
      });
    },
  );
});
