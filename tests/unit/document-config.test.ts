import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  DEVELOPMENT_POLICY_VERSION,
  getSubmissionConfiguration,
} from "@/server/documents/config";
import { ApiError } from "@/server/errors";
import { getSigningConfiguration } from "@/server/signing/config";
import {
  SIGNING_SHARING_POLICY_VERSION,
  SIGNING_UPLOAD_POLICY_VERSION,
} from "@/lib/signing/policy";

const remoteOrigin = "https://dvp.ilkomith.cloud";
const maxBytes = 10 * 1024 * 1024;

beforeEach(() => {
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DOCUMENT_ENVIRONMENT", undefined);
  vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", undefined);
  vi.stubEnv("DOCUMENT_MAX_FILE_BYTES", undefined);
});

afterEach(() => vi.unstubAllEnvs());

function expectUnavailable(
  configuration: () => unknown = getSubmissionConfiguration,
) {
  let failure: unknown;
  try {
    configuration();
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(ApiError);
  expect(failure).toMatchObject({ status: 503, code: "UPLOAD_UNAVAILABLE" });
}

describe("synthetic development document configuration", () => {
  it.each([
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://[::1]:3000",
  ])(
    "preserves local defaults on %s even with a production Next.js build",
    (origin) => {
      vi.stubEnv("APP_URL", origin);
      expect(getSubmissionConfiguration()).toEqual({
        maxBytes,
        policyVersion: DEVELOPMENT_POLICY_VERSION,
        environment: "development",
      });
    },
  );

  it("keeps remote documents disabled by default", () => {
    vi.stubEnv("APP_URL", remoteOrigin);
    expectUnavailable();
  });

  it("permits only the explicitly configured HTTPS origin and retains development policy", () => {
    vi.stubEnv("APP_URL", remoteOrigin);
    vi.stubEnv("DOCUMENT_ENVIRONMENT", "development");
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", remoteOrigin);
    expect(getSubmissionConfiguration()).toEqual({
      maxBytes,
      policyVersion: DEVELOPMENT_POLICY_VERSION,
      environment: "development",
    });
    expect(getSigningConfiguration()).toEqual({
      maxBytes,
      environment: "development",
      uploadPolicyVersion: SIGNING_UPLOAD_POLICY_VERSION,
      sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
    });
  });

  it("matches the canonical application origin rather than its textual spelling", () => {
    vi.stubEnv("APP_URL", "https://DVP.ILKOMITH.CLOUD:443/");
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", remoteOrigin);
    expect(getSubmissionConfiguration().environment).toBe("development");
  });

  it.each([
    "",
    "*",
    "https://*.ilkomith.cloud",
    "https://dvp.ilkomith.cloud/**",
    "dvp.ilkomith.cloud",
    "http://dvp.ilkomith.cloud",
    "https://other.example.invalid",
    "https://dvp.ilkomith.cloud.attacker.example",
    "https://dvp.ilkomith.cloud:444",
    "https://user:password@dvp.ilkomith.cloud",
    "https://dvp.ilkomith.cloud/",
    "https://dvp.ilkomith.cloud/signing",
    "https://dvp.ilkomith.cloud?test=1",
    "https://dvp.ilkomith.cloud#test",
    "https://dvp.ilkomith.cloud,https://other.example.invalid",
  ])("rejects a missing, unsafe, or nonexact remote opt-in %j", (value) => {
    vi.stubEnv("APP_URL", remoteOrigin);
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", value);
    expectUnavailable();
  });

  it.each([
    "https://other.example.invalid",
    "https://sub.dvp.ilkomith.cloud",
    "https://dvp.ilkomith.cloud.attacker.example",
    "https://dvp.ilkomith.cloud:444",
    "https://localhost.attacker.example",
  ])("does not authorize another application origin %s", (origin) => {
    vi.stubEnv("APP_URL", origin);
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", remoteOrigin);
    expectUnavailable();
  });

  it("does not authorize plaintext HTTP on a remote deployment", () => {
    const origin = "http://dvp.ilkomith.cloud";
    vi.stubEnv("APP_URL", origin);
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", origin);
    expect(getSubmissionConfiguration).toThrow(
      "Layanan autentikasi belum dikonfigurasi.",
    );
  });

  it.each(["production", "staging", ""])(
    "does not open document policy for environment %j even with explicit remote opt-in",
    (environment) => {
      vi.stubEnv("APP_URL", remoteOrigin);
      vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", remoteOrigin);
      vi.stubEnv("DOCUMENT_ENVIRONMENT", environment);
      expectUnavailable();
      expectUnavailable(getSigningConfiguration);
    },
  );

  it.each(["0", "-1", "1.5", "NaN", "Infinity", "10485761", ""])(
    "retains upload size validation for remote development (%j)",
    (value) => {
      vi.stubEnv("APP_URL", remoteOrigin);
      vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", remoteOrigin);
      vi.stubEnv("DOCUMENT_MAX_FILE_BYTES", value);
      expectUnavailable();
    },
  );

  it("allows a lower file limit without exposing the deployment opt-in to form props", () => {
    vi.stubEnv("APP_URL", remoteOrigin);
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", remoteOrigin);
    vi.stubEnv("DOCUMENT_MAX_FILE_BYTES", "1048576");
    expect(getSubmissionConfiguration()).toEqual({
      maxBytes: 1024 * 1024,
      policyVersion: DEVELOPMENT_POLICY_VERSION,
      environment: "development",
    });
  });

  it("keeps signing reads and actions unavailable when the deployment is not opted in", () => {
    vi.stubEnv("APP_URL", remoteOrigin);
    expectUnavailable(getSigningConfiguration);
  });
});
