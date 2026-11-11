import { describe, expect, it } from "vitest";
import {
  defaultWorkspacePath,
  resolveAuthorizedReturnTo,
  sanitizeReturnTo,
} from "@/lib/auth/redirects";

describe("auth return destinations", () => {
  it.each([
    "/dashboard",
    "/documents?status=approved",
    "/documents/123e4567-e89b-12d3-a456-426614174000",
    "/admin/review-queue?status=pending_review",
    "/verify",
    "/profile",
    "/signing/documents",
    "/signing/new",
    "/requests/incoming",
    "/requests/outgoing",
    "/requests/123e4567-e89b-12d3-a456-426614174000",
  ])("accepts an unambiguous private app destination %s", (value) => {
    expect(sanitizeReturnTo(value)).toBe(value);
  });

  it.each([
    undefined,
    null,
    123,
    {},
    "",
    "https://attacker.example/",
    "//attacker.example/",
    "/\\attacker.example",
    "/dashboard\\anything",
    " /dashboard",
    "/dashboard ",
    "/dashboard\n",
    "/dashboard?value=%0aheader",
    "/dashboard%2f..%2fadmin",
    "/%64ashboard",
    "/documents/%252e%252e/admin",
    "/documents/../admin",
    "/documents//admin",
    "/login",
    "/register",
    "/auth/callback?code=secret",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/api/v1/me",
    "/dashboard#section",
    "/administer",
    "/documents-other",
    "/" + "a".repeat(2048),
  ])("rejects external, encoded, looping, or ambiguous input", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/dashboard");
  });

  it("validates the fallback instead of accepting an external fallback", () => {
    expect(sanitizeReturnTo(undefined, "https://attacker.example")).toBe(
      "/dashboard",
    );
    expect(sanitizeReturnTo(undefined, "/admin/overview")).toBe(
      "/admin/overview",
    );
  });
});

describe("role-aware auth destinations", () => {
  it.each([
    "/dashboard",
    "/documents?status=approved",
    "/submit",
    "/verify?method=qr",
    "/signing/documents",
    "/signing/new",
    "/requests/incoming",
    "/receipts/opaque-receipt",
  ])("keeps an administrator out of user destinations such as %s", (next) => {
    for (const roles of [
      ["platform_admin"],
      ["user", "platform_admin"],
      ["user", "reviewer", "platform_admin"],
    ] as const)
      expect(resolveAuthorizedReturnTo(next, roles)).toBe("/admin/overview");
  });
  it("retains shared account settings and authorized admin deep links", () => {
    for (const next of ["/profile", "/admin/operations"])
      expect(resolveAuthorizedReturnTo(next, ["user", "platform_admin"])).toBe(
        next,
      );
    expect(resolveAuthorizedReturnTo("", ["user", "platform_admin"])).toBe(
      "/admin/overview",
    );
  });
  it("sends normal users to their workspace", () => {
    expect(defaultWorkspacePath(["user"])).toBe("/dashboard");
    expect(defaultWorkspacePath([])).toBe("/dashboard");
  });
  it("separates reviewer archives from platform monitoring", () => {
    expect(defaultWorkspacePath(["user", "reviewer"])).toBe(
      "/admin/review-queue",
    );
    expect(defaultWorkspacePath(["platform_admin"])).toBe("/admin/overview");
  });
  it("does not let a next parameter grant admin or reviewer scope", () => {
    expect(resolveAuthorizedReturnTo("/admin/operations", ["reviewer"])).toBe(
      "/admin/review-queue",
    );
    expect(
      resolveAuthorizedReturnTo("/admin/overview", ["user", "reviewer"]),
    ).toBe("/admin/review-queue");
    expect(
      resolveAuthorizedReturnTo("/admin/operations", [
        "reviewer",
        "platform_admin",
      ]),
    ).toBe("/admin/operations");
    expect(resolveAuthorizedReturnTo("/admin/overview", ["user"])).toBe(
      "/dashboard",
    );
    expect(
      resolveAuthorizedReturnTo("/admin/review-queue/opaque-id", [
        "platform_admin",
      ]),
    ).toBe("/admin/overview");
    expect(
      resolveAuthorizedReturnTo("/admin/review-history", ["platform_admin"]),
    ).toBe("/admin/overview");
  });
  it("retains an authorized return destination", () => {
    expect(
      resolveAuthorizedReturnTo("/admin/review-queue/opaque-id", ["reviewer"]),
    ).toBe("/admin/review-queue/opaque-id");
    expect(
      resolveAuthorizedReturnTo("/documents?status=approved", ["reviewer"]),
    ).toBe("/documents?status=approved");
  });
  it("uses the current roles for malformed return parameters", () => {
    expect(resolveAuthorizedReturnTo("//attacker.example", ["reviewer"])).toBe(
      "/admin/review-queue",
    );
    expect(resolveAuthorizedReturnTo("//attacker.example", ["user"])).toBe(
      "/dashboard",
    );
  });
});
