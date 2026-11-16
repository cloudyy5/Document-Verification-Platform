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
const origin = "https://prototype.example.invalid";
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
  return JSON.parse(output).services.web;
}

function check(passed) {
  if (!passed) throw new Error("COMPOSE_CONTRACT_FAILED");
}

let stage = "prototype runtime environment";
try {
  const prototype = config({
    DOCUMENT_ENVIRONMENT: "development",
    DOCUMENT_DEVELOPMENT_ORIGIN: origin,
  });
  check(prototype.environment.APP_URL === origin);
  check(prototype.environment.DOCUMENT_ENVIRONMENT === "development");
  check(prototype.environment.DOCUMENT_DEVELOPMENT_ORIGIN === origin);
  check(prototype.build.target === "runner");
  check(!prototype.volumes?.length);
  for (const name of [
    "SUPABASE_SECRET_KEY",
    "AUTH_FLOW_SECRET",
    "DOCUMENT_DEVELOPMENT_ORIGIN",
  ])
    check(!Object.hasOwn(prototype.build.args, name));
  console.log("LULUS | prototype origin reaches runner at runtime only");

  stage = "unconfigured document policy";
  const defaults = config({});
  check(defaults.environment.DOCUMENT_ENVIRONMENT === "production");
  check(defaults.environment.DOCUMENT_DEVELOPMENT_ORIGIN === "");
  check(Number(defaults.environment.DOCUMENT_MAX_FILE_BYTES) === 10485760);
  console.log("LULUS | unset document policy stays closed to prototype use");

  stage = "development Compose override";
  const development = config({ DOCUMENT_DEVELOPMENT_ORIGIN: origin }, true);
  check(development.build.target === "dev");
  check(development.environment.DOCUMENT_ENVIRONMENT === "development");
  check(development.environment.DOCUMENT_DEVELOPMENT_ORIGIN === origin);
  console.log(
    "LULUS | development override inherits the exact prototype origin",
  );

  stage = "explicit production document policy";
  const production = config({
    DOCUMENT_ENVIRONMENT: "production",
    DOCUMENT_DEVELOPMENT_ORIGIN: origin,
  });
  check(production.environment.DOCUMENT_ENVIRONMENT === "production");
  check(production.environment.DOCUMENT_DEVELOPMENT_ORIGIN === origin);
  console.log("LULUS | explicit production document policy is not rewritten");
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
