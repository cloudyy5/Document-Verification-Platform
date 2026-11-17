import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getPublicServiceContact } from "@/server/service-contact";
beforeEach(() => {
  vi.stubEnv("SERVICE_OPERATOR_NAME", undefined);
  vi.stubEnv("SERVICE_SUPPORT_EMAIL", undefined);
});
afterEach(() => vi.unstubAllEnvs());
describe("approved public service contact", () => {
  it("defaults only to the operator identity explicitly provided by the owner", () => {
    expect(getPublicServiceContact()).toEqual({
      name: "KPILKOMITH",
      email: "kp.ilkomith@gmail.com",
    });
  });
  it("does not return server secrets or unrelated configuration", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "private-canary");
    expect(JSON.stringify(getPublicServiceContact())).not.toContain("canary");
  });
  it("validates configured email before exposing a mail link", () => {
    vi.stubEnv(
      "SERVICE_SUPPORT_EMAIL",
      "support@example.invalid\r\nBcc:other@example.invalid",
    );
    expect(getPublicServiceContact()).toBeNull();
  });
});
