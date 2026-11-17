import { execFileSync } from "node:child_process";
import { mkdtempSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Config evaluation only: no Docker Engine, build, container or Supabase calls.
// An optional standalone Compose binary supports hosts without Docker Engine.
const composeBinary = process.argv[2];
const command = composeBinary ?? "docker";
const prefix = composeBinary ? [] : ["compose"];
const project = fileURLToPath(new URL("../", import.meta.url));
const temporaryDirectory = mkdtempSync(join(tmpdir(), "dvp-compose-config-"));
const environmentFile = join(temporaryDirectory, "synthetic.env");
writeFileSync(environmentFile, "# Empty fixture; all values are synthetic.\n");

// Never inherit application credentials, Compose overrides or a local env file.
const osEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    [
      "PATH",
      "SYSTEMROOT",
      "WINDIR",
      "TEMP",
      "TMP",
      "TMPDIR",
      "COMSPEC",
      "PATHEXT",
      "HOME",
      "USERPROFILE",
      "LOCALAPPDATA",
      "APPDATA",
    ].includes(name.toUpperCase()),
  ),
);
const origin = "https://documents.example.invalid";
const connection = {
  APP_URL: origin,
  AUTH_FLOW_SECRET: "synthetic-compose-config-flow-secret-123456",
  SUPABASE_SECRET_KEY: "sb_secret_synthetic_compose_config",
  NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable_synthetic_compose_config",
};

function config(extraEnvironment, developmentOverride = false) {
  const files = ["-f", "docker-compose.yml"];
  if (developmentOverride) files.push("-f", "docker-compose.dev.yml");
  const output = execFileSync(
    command,
    [
      ...prefix,
      "--env-file",
      environmentFile,
      ...files,
      "config",
      "--format",
      "json",
    ],
    {
      cwd: project,
      env: { ...osEnvironment, ...connection, ...extraEnvironment },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    },
  );
  return JSON.parse(output);
}

function check(passed) {
  if (!passed) throw new Error("COMPOSE_CONTRACT_FAILED");
}

let stage = "production service configuration";
try {
  const configValue = config({});
  const web = configValue.services.web,
    clamav = configValue.services.clamav;
  check(web.environment.DOCUMENT_ENVIRONMENT === "production");
  check(!Object.hasOwn(web.environment, "DOCUMENT_DEVELOPMENT_ORIGIN"));
  check(
    web.environment.CLAMAV_HOST === "clamav" &&
      web.environment.CLAMAV_PORT === "3310",
  );
  check(Number(web.environment.DOCUMENT_MAX_FILE_BYTES) === 10485760);
  check(web.depends_on.clamav.condition === "service_healthy");
  check(clamav.image === "clamav/clamav:1.4" && !clamav.ports?.length);
  check(clamav.healthcheck.test.includes("clamdcheck.sh"));
  check(clamav.volumes?.some((v) => v.target === "/var/lib/clamav"));
  check(web.build.target === "runner" && !web.volumes?.length);
  for (const key of ["SUPABASE_SECRET_KEY", "AUTH_FLOW_SECRET", "CLAMAV_HOST"])
    check(!Object.hasOwn(web.build.args, key));
  console.log(
    "LULUS | production runner requires private healthy ClamAV; runtime secrets stay outside build args",
  );
  stage = "development override";
  const local = config({}, true).services.web;
  check(
    local.build.target === "dev" &&
      local.environment.DOCUMENT_ENVIRONMENT === "development",
  );
  check(local.environment.CLAMAV_HOST === "clamav");
  console.log(
    "LULUS | local development override retains ClamAV configuration",
  );
} catch {
  // Never print child output, normalized configuration or environment values.
  console.error(
    `PERIKSA | ${stage}; verify Compose availability and runtime mappings.`,
  );
  process.exitCode = 1;
} finally {
  unlinkSync(environmentFile);
  rmdirSync(temporaryDirectory);
}
