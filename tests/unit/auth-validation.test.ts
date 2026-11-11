import { describe, expect, it } from "vitest";
import {
  authFields,
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "../../src/lib/auth/validation";

const credentials = {
  fullName: "  Nama Pengguna  ",
  email: "Owner@EXAMPLE.COM",
  password: " password123 ",
  confirmPassword: " password123 ",
};

describe("authentication input validation", () => {
  it("normalizes profile/email while preserving password bytes", () => {
    const parsed = registerSchema.parse(credentials);
    expect(parsed).toEqual({
      ...credentials,
      fullName: "Nama Pengguna",
      email: "owner@example.com",
    });
    expect(loginSchema.parse(credentials)).toEqual({
      email: "owner@example.com",
      password: " password123 ",
    });
    expect(resetPasswordSchema.parse(credentials)).toEqual({
      password: " password123 ",
      confirmPassword: " password123 ",
    });
  });

  it("does not trust extra identity or role fields", () => {
    const parsed = registerSchema.parse({
      ...credentials,
      role: "platform_admin",
      roles: ["reviewer"],
      owner_id: "another-owner",
      reviewer_id: "another-reviewer",
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "confirmPassword",
      "email",
      "fullName",
      "password",
    ]);
  });

  it.each([8, 128])("accepts a valid new password length of %s", (size) => {
    const password = "p".repeat(size);
    expect(
      resetPasswordSchema.safeParse({ password, confirmPassword: password })
        .success,
    ).toBe(true);
    expect(
      registerSchema.safeParse({
        ...credentials,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(true);
  });

  it.each([0, 7, 129])("rejects a new password length of %s", (size) => {
    const password = "p".repeat(size);
    expect(
      resetPasswordSchema.safeParse({ password, confirmPassword: password })
        .success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        ...credentials,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(false);
  });

  it("reports mismatched confirmation on its field", () => {
    for (const result of [
      registerSchema.safeParse({
        ...credentials,
        confirmPassword: "different-password",
      }),
      resetPasswordSchema.safeParse({
        password: "valid-password",
        confirmPassword: "different-password",
      }),
    ]) {
      expect(result.success).toBe(false);
      if (!result.success)
        expect(
          result.error.issues.some(
            (issue) => issue.path[0] === "confirmPassword",
          ),
        ).toBe(true);
    }
  });

  it.each(["", "   ", "x".repeat(121)])(
    "rejects missing or oversized profile names",
    (fullName) => {
      expect(
        registerSchema.safeParse({ ...credentials, fullName }).success,
      ).toBe(false);
    },
  );

  it("accepts the profile database name boundary", () => {
    expect(
      registerSchema.safeParse({ ...credentials, fullName: "N".repeat(120) })
        .success,
    ).toBe(true);
  });

  it.each([
    "",
    "wrong",
    "@example.com",
    "name@",
    "a".repeat(255) + "@example.com",
  ])("rejects invalid email input", (email) => {
    expect(emailSchema.safeParse({ email }).success).toBe(false);
  });

  it("does not trim login passwords or impose the new-password minimum on existing credentials", () => {
    expect(
      loginSchema.parse({ email: "a@example.com", password: " x " }).password,
    ).toBe(" x ");
    expect(
      loginSchema.safeParse({ email: "a@example.com", password: "" }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({
        email: "a@example.com",
        password: "x".repeat(129),
      }).success,
    ).toBe(false);
  });

  it("extracts only allowlisted FormData fields", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      ...credentials,
      role: "platform_admin",
      owner_id: "another-owner",
      reviewer_id: "another-reviewer",
      next: "https://attacker.example",
    }))
      form.set(key, value);
    expect(authFields(form)).toEqual(credentials);
    expect(registerSchema.parse(authFields(form))).not.toHaveProperty("role");
  });

  it("rejects a File supplied in place of a string field", () => {
    const form = new FormData();
    form.set("email", new File(["test"], "not-an-email.txt"));
    form.set("password", "password123");
    expect(loginSchema.safeParse(authFields(form)).success).toBe(false);
  });

  it("does not coerce missing credentials into usable strings", () => {
    const values = authFields(new FormData());
    expect(loginSchema.safeParse(values).success).toBe(false);
    expect(registerSchema.safeParse(values).success).toBe(false);
    expect(resetPasswordSchema.safeParse(values).success).toBe(false);
  });
});
