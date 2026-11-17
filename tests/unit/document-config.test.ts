import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getSubmissionConfiguration } from "@/server/documents/config";
import { getSigningConfiguration } from "@/server/signing/config";
import { SUBMISSION_POLICY_VERSION } from "@/lib/documents/policy";
import {
  SIGNING_UPLOAD_POLICY_VERSION,
  SIGNING_SHARING_POLICY_VERSION,
} from "@/lib/signing/policy";
beforeEach(() => {
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  vi.stubEnv("DOCUMENT_ENVIRONMENT", undefined);
  vi.stubEnv("DOCUMENT_MAX_FILE_BYTES", undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe("public document configuration", () => {
  it.each([
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://[::1]:3000",
  ])("supports local development on %s", (origin) => {
    vi.stubEnv("APP_URL", origin);
    expect(getSubmissionConfiguration()).toEqual({
      maxBytes: 10485760,
      policyVersion: SUBMISSION_POLICY_VERSION,
      environment: "development",
    });
  });
  it("uses current public service policy on a canonical HTTPS deployment", () => {
    vi.stubEnv("APP_URL", "https://dvp.ilkomith.cloud");
    expect(getSubmissionConfiguration()).toEqual({
      maxBytes: 10485760,
      policyVersion: SUBMISSION_POLICY_VERSION,
      environment: "production",
    });
    expect(getSigningConfiguration()).toEqual({
      maxBytes: 10485760,
      environment: "production",
      uploadPolicyVersion: SIGNING_UPLOAD_POLICY_VERSION,
      sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
    });
  });
  it("does not need the old remote-development opt-in", () => {
    vi.stubEnv("APP_URL", "https://dvp.ilkomith.cloud");
    vi.stubEnv("DOCUMENT_ENVIRONMENT", "production");
    vi.stubEnv("DOCUMENT_DEVELOPMENT_ORIGIN", "https://other.invalid");
    expect(getSubmissionConfiguration().environment).toBe("production");
  });
  it.each(["development", "staging", ""])(
    "rejects invalid public mode %j",
    (environment) => {
      vi.stubEnv("APP_URL", "https://dvp.ilkomith.cloud");
      vi.stubEnv("DOCUMENT_ENVIRONMENT", environment);
      expect(getSubmissionConfiguration).toThrow();
    },
  );
  it("rejects public plaintext HTTP", () => {
    vi.stubEnv("APP_URL", "http://dvp.ilkomith.cloud");
    expect(getSubmissionConfiguration).toThrow();
  });
  it.each(["0", "-1", "1.5", "NaN", "Infinity", "10485761", ""])(
    "keeps the approved size bound (%s)",
    (value) => {
      vi.stubEnv("DOCUMENT_MAX_FILE_BYTES", value);
      expect(getSubmissionConfiguration).toThrow();
    },
  );
  it("supports lower size limits without exposing scanner internals", () => {
    vi.stubEnv("DOCUMENT_MAX_FILE_BYTES", "1048576");
    expect(getSubmissionConfiguration().maxBytes).toBe(1048576);
    expect(JSON.stringify(getSigningConfiguration())).not.toMatch(
      /CLAMAV|secret|host|port/i,
    );
  });
});
