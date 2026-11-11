import { randomBytes, randomUUID } from "node:crypto";

// CLI only. Never import this file into the application or print configuration.
const configuration = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  publicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  secretKey: process.env.SUPABASE_SECRET_KEY?.trim(),
};

function legacyRole(key, expected) {
  try {
    const parts = key.split(".");
    return (
      parts.length === 3 &&
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ===
        expected
    );
  } catch {
    return false;
  }
}

function configurationValid() {
  try {
    const url = new URL(configuration.url);
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    return (
      (url.protocol === "https:" || (url.protocol === "http:" && loopback)) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      Boolean(
        configuration.publicKey &&
        (/^sb_publishable_[A-Za-z0-9_-]+$/.test(configuration.publicKey) ||
          legacyRole(configuration.publicKey, "anon")),
      ) &&
      Boolean(
        configuration.secretKey &&
        (/^sb_secret_[A-Za-z0-9_-]+$/.test(configuration.secretKey) ||
          legacyRole(configuration.secretKey, "service_role")),
      )
    );
  } catch {
    return false;
  }
}

async function request(path, key, { method = "GET", body } = {}) {
  const headers = { apikey: key };
  if (key.split(".").length === 3) headers.Authorization = `Bearer ${key}`;
  if (body) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(new URL(path, configuration.url), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const data = method === "HEAD" ? undefined : await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: "NETWORK_ERROR", data: undefined };
  }
}

let failed = false;
function report(label, passed, status) {
  if (!passed) failed = true;
  console.log(
    `${passed ? "LULUS" : "PERIKSA"} | ${label}${status ? ` | ${status}` : ""}`,
  );
}
function safeStatus(result) {
  const code = result.data?.code;
  return `${result.status}${typeof code === "string" && /^[A-Z0-9]{3,12}$/.test(code) ? ` (${code})` : ""}`;
}

async function main() {
  console.log(
    "Pemeriksaan baca saja. Nilai key dan data akun tidak ditampilkan.",
  );
  if (!configurationValid()) {
    report("Format URL / publishable key / secret key di .env.local", false);
    return;
  }
  report("Format konfigurasi koneksi", true);

  const auth = await request("/auth/v1/settings", configuration.publicKey);
  report(
    "Auth API menerima publishable key",
    auth.ok && typeof auth.data === "object" && auth.data !== null,
    auth.status,
  );
  if (auth.ok && auth.data) {
    report(
      "Email provider dan signup aktif",
      auth.data.external?.email === true && auth.data.disable_signup === false,
    );
    report("Confirm email wajib", auth.data.mailer_autoconfirm === false);
  }

  const table = await request(
    "/rest/v1/user_roles?select=role&limit=0",
    configuration.secretKey,
    { method: "HEAD" },
  );
  report(
    "Database API / tabel role menerima server key",
    table.ok,
    table.status,
  );

  // This migration-006 function is SELECT EXISTS only. Never call issue/consume.
  const recovery = await request(
    "/rest/v1/rpc/is_auth_recovery_grant_valid",
    configuration.secretKey,
    {
      method: "POST",
      body: {
        p_token_digest: randomBytes(32).toString("hex"),
        p_user_id: randomUUID(),
        p_session_id: randomUUID(),
      },
    },
  );
  report(
    "RPC keamanan Phase 2 tersedia (pemeriksaan token acak)",
    recovery.ok && recovery.data === false,
    recovery.status,
  );
  if (process.argv.includes("--workspace")) {
    const counts = await request(
      "/rest/v1/rpc/get_own_workspace_counts",
      configuration.publicKey,
      { method: "POST", body: {} },
    );
    report(
      "RPC workspace Phase 3 tersedia dan menolak anon",
      [401, 403].includes(counts.status) && counts.data?.code === "42501",
      safeStatus(counts),
    );
    // Deliberately invalid input is rejected BEFORE locks/deletes/counter writes
    // in migration 008. This checks presence without spending upload quota.
    const limiter = await request(
      "/rest/v1/rpc/consume_document_upload_limit",
      configuration.secretKey,
      {
        method: "POST",
        body: { p_key_digest: "invalid", p_global_digest: "invalid" },
      },
    );
    report(
      "RPC upload Phase 3 tersedia dan menolak input invalid tanpa perubahan counter",
      limiter.status === 400 && limiter.data?.code === "22023",
      safeStatus(limiter),
    );
  }
  if (process.argv.includes("--signing")) {
    // HEAD + limit=0 checks columns without fetching any account/document row.
    const tables = {
      signing_user_identifiers: "user_id,code,created_at",
      signing_documents: "id,owner_id,created_at",
      signing_document_versions:
        "id,document_id,owner_id,version_no,source_sha256,upload_policy_version",
      signing_requests:
        "id,document_id,source_version_id,owner_id,recipient_id,status,expires_at",
    };
    for (const [name, columns] of Object.entries(tables)) {
      const path = `/rest/v1/${name}?select=${columns}&limit=0`;
      const [server, anonymous] = await Promise.all([
        request(path, configuration.secretKey, { method: "HEAD" }),
        request(path, configuration.publicKey, { method: "HEAD" }),
      ]);
      report(
        `R2 / ${name} tersedia melalui Data API`,
        server.ok,
        server.status,
      );
      report(
        `R2 / ${name} menolak pembacaan anon`,
        [401, 403].includes(anonymous.status),
        anonymous.status,
      );
    }
    // An explicit NULL actor is rejected by is_signing_user BEFORE any lock,
    // object lookup, insert, notification or audit event. Never use a real ID.
    // The limiter's invalid parameters fail BEFORE its counter cleanup/writes.
    const probes = {
      lookup_signing_recipient: { p_actor_id: null, p_code: null },
      create_signing_draft: {
        p_actor_id: null,
        p_document_id: null,
        p_version_id: null,
        p_title: null,
        p_category_id: null,
        p_custom_document_type: null,
        p_document_date: null,
        p_issuing_institution: null,
        p_description: null,
        p_original_filename: null,
        p_file_size_bytes: null,
        p_source_sha256: null,
        p_storage_path: null,
        p_upload_policy_version: null,
        p_upload_consent: null,
      },
      send_signing_request: {
        p_actor_id: null,
        p_request_id: null,
        p_source_version_id: null,
        p_recipient_code: null,
        p_recipient_id: null,
        p_sharing_policy_version: null,
        p_sharing_consent: null,
      },
      cancel_signing_request: { p_actor_id: null, p_request_id: null },
      consume_signing_operation_limit: {
        p_action: "invalid",
        p_key_digest: "invalid",
        p_global_digest: "invalid",
      },
    };
    for (const [name, body] of Object.entries(probes)) {
      const [server, anonymous] = await Promise.all([
        request(`/rest/v1/rpc/${name}`, configuration.secretKey, {
          method: "POST",
          body,
        }),
        request(`/rest/v1/rpc/${name}`, configuration.publicKey, {
          method: "POST",
          body,
        }),
      ]);
      const limiter = name === "consume_signing_operation_limit";
      report(
        `R2 / ${name} tersedia dan menolak probe tanpa mutasi`,
        limiter
          ? server.status === 400 && server.data?.code === "22023"
          : [401, 403].includes(server.status) &&
              server.data?.code === "42501" &&
              server.data?.message === "SIGNING_ACTOR_REQUIRED",
        safeStatus(server),
      );
      report(
        `R2 / ${name} tidak dapat dipanggil anon`,
        [401, 403].includes(anonymous.status) &&
          anonymous.data?.code === "42501" &&
          anonymous.data?.message === `permission denied for function ${name}`,
        safeStatus(anonymous),
      );
    }
    console.log(
      "Preflight R2 tidak membuktikan sesi pengguna, backfill kode, RLS peserta, atau perjalanan upload/undangan cloud.",
    );
  }
  if (process.argv.includes("--signing-r3")) {
    // HEAD retrieves no receipt/account rows. NULL actor and invalid limiter
    // input fail before locks, audit, notifications or counter writes in 010.
    const tables = {
      signing_decisions:
        "id,request_id,source_version_id,actor_id,action,reason,policy_version,authentication_method",
      signing_receipts:
        "id,decision_id,request_id,source_version_id,owner_id,recipient_id,source_sha256,layout_version",
      signing_artifacts:
        "receipt_id,state,artifact_sha256,file_size_bytes,page_count,ready_at",
    };
    for (const [name, columns] of Object.entries(tables)) {
      const path = `/rest/v1/${name}?select=${columns}&limit=0`;
      const [server, anonymous] = await Promise.all([
        request(path, configuration.secretKey, { method: "HEAD" }),
        request(path, configuration.publicKey, { method: "HEAD" }),
      ]);
      report(
        `R3 / ${name} tersedia melalui Data API`,
        server.ok,
        server.status,
      );
      report(
        `R3 / ${name} menolak anon`,
        [401, 403].includes(anonymous.status),
        anonymous.status,
      );
    }
    const probes = {
      decide_signing_request: {
        p_actor_id: null,
        p_request_id: null,
        p_decision_id: null,
        p_source_version_id: null,
        p_source_sha256: null,
        p_action: null,
        p_reason: null,
        p_policy_version: null,
        p_consent: null,
        p_confirmed: null,
        p_confirmation_digest: null,
      },
      claim_signing_render: { p_actor_id: null, p_receipt_id: null },
      complete_signing_render: {
        p_actor_id: null,
        p_receipt_id: null,
        p_claim_token: null,
        p_storage_path: null,
        p_file_size_bytes: null,
        p_artifact_sha256: null,
        p_page_count: null,
      },
      fail_signing_render: {
        p_actor_id: null,
        p_receipt_id: null,
        p_claim_token: null,
        p_failure_code: null,
      },
      consume_signing_r3_limit: {
        p_action: "invalid",
        p_key_digest: "invalid",
        p_global_digest: "invalid",
      },
    };
    for (const [name, body] of Object.entries(probes)) {
      const [server, anonymous] = await Promise.all([
        request(`/rest/v1/rpc/${name}`, configuration.secretKey, {
          method: "POST",
          body,
        }),
        request(`/rest/v1/rpc/${name}`, configuration.publicKey, {
          method: "POST",
          body,
        }),
      ]);
      const limiter = name === "consume_signing_r3_limit";
      report(
        `R3 / ${name} tersedia dan menolak probe tanpa mutasi`,
        limiter
          ? server.status === 400 && server.data?.code === "22023"
          : [401, 403].includes(server.status) &&
              server.data?.code === "42501" &&
              server.data?.message === "SIGNING_ACTOR_REQUIRED",
        safeStatus(server),
      );
      report(
        `R3 / ${name} tidak dapat dipanggil anon`,
        [401, 403].includes(anonymous.status) &&
          anonymous.data?.code === "42501" &&
          anonymous.data?.message === `permission denied for function ${name}`,
        safeStatus(anonymous),
      );
    }
    const bucket = await request(
      "/storage/v1/bucket/signing-results",
      configuration.secretKey,
    );
    report(
      "R3 / bucket hasil PDF privat dengan batas 20 MiB",
      bucket.ok &&
        bucket.data?.id === "signing-results" &&
        bucket.data?.public === false &&
        Number(bucket.data?.file_size_limit) === 20971520 &&
        Array.isArray(bucket.data?.allowed_mime_types) &&
        bucket.data.allowed_mime_types.length === 1 &&
        bucket.data.allowed_mime_types[0] === "application/pdf",
      bucket.status,
    );
    console.log(
      "Preflight R3 tidak membuat receipt/PDF/akun dan tidak membuktikan sesi peserta, keputusan atau rendering cloud.",
    );
  }
  if (process.argv.includes("--qr-placement")) {
    const path =
      "/rest/v1/signing_receipt_layouts?select=receipt_id,layout_version,placement_plan,plan_sha256&limit=0";
    const [server, anonymous] = await Promise.all([
      request(path, configuration.secretKey, { method: "HEAD" }),
      request(path, configuration.publicKey, { method: "HEAD" }),
    ]);
    report("R3b / manifest posisi tersedia", server.ok, server.status);
    report(
      "R3b / manifest posisi menolak anon",
      [401, 403].includes(anonymous.status),
      anonymous.status,
    );
    const body = {
      p_actor_id: null,
      p_request_id: null,
      p_decision_id: null,
      p_source_version_id: null,
      p_source_sha256: null,
      p_policy_version: null,
      p_consent: null,
      p_confirmed: null,
      p_confirmation_digest: null,
      p_placement_plan: null,
    };
    const rpc = "approve_signing_request_with_placement";
    const [service, anon] = await Promise.all([
      request(`/rest/v1/rpc/${rpc}`, configuration.secretKey, {
        method: "POST",
        body,
      }),
      request(`/rest/v1/rpc/${rpc}`, configuration.publicKey, {
        method: "POST",
        body,
      }),
    ]);
    report(
      "R3b / approval posisi menolak actor null sebelum mutasi",
      [401, 403].includes(service.status) &&
        service.data?.code === "42501" &&
        service.data?.message === "SIGNING_ACTOR_REQUIRED",
      safeStatus(service),
    );
    report(
      "R3b / approval posisi tidak dapat dipanggil anon",
      [401, 403].includes(anon.status) &&
        anon.data?.code === "42501" &&
        anon.data?.message === `permission denied for function ${rpc}`,
      safeStatus(anon),
    );
    console.log(
      "Preflight R3b tidak membuat posisi, persetujuan, akun atau PDF.",
    );
  }
  if (process.argv.includes("--operations")) {
    const rpc = "get_operations_snapshot";
    const [service, anon] = await Promise.all([
      request(`/rest/v1/rpc/${rpc}`, configuration.secretKey, {
        method: "POST",
        body: {},
      }),
      request(`/rest/v1/rpc/${rpc}`, configuration.publicKey, {
        method: "POST",
        body: {},
      }),
    ]);
    report(
      "R4 / snapshot tersedia dan menolak service/null actor tanpa mengambil statistik",
      [401, 403].includes(service.status) &&
        service.data?.code === "42501" &&
        service.data?.message === "OPERATIONS_ACTOR_REQUIRED",
      safeStatus(service),
    );
    report(
      "R4 / snapshot menolak EXECUTE anon",
      [401, 403].includes(anon.status) &&
        anon.data?.code === "42501" &&
        anon.data?.message === `permission denied for function ${rpc}`,
      safeStatus(anon),
    );
    console.log(
      "Preflight R4 tidak membaca statistik global dan tidak membuat akun, role, audit atau dokumen.",
    );
  }
  console.log(
    "Pengiriman email, template, login browser, dan seluruh migration belum dibuktikan oleh pemeriksaan ini.",
  );
}

try {
  await main();
} catch {
  report(
    "Pemeriksaan tidak dapat diselesaikan; tidak ada detail rahasia ditampilkan",
    false,
  );
}
process.exitCode = failed ? 1 : 0;
