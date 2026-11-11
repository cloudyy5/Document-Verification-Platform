import { expect, test } from "@playwright/test";

// File-scoped worker options: traces can include fill() password arguments.
test.use({ trace: "off", screenshot: "off" });

// Guest requests do not create accounts, send email, or upload file bytes.
// This checks the application's authentication boundary, not database RLS.
test("API workspace privat menolak guest sebelum membaca atau mengubah data", async ({
  request,
  baseURL,
}) => {
  const documentId = "10000000-0000-4000-8000-000000000001";
  for (const pathname of [
    "/api/v1/dashboard",
    "/api/v1/categories",
    "/api/v1/documents",
    `/api/v1/documents/${documentId}`,
    `/api/v1/documents/${documentId}/file`,
  ]) {
    const response = await request.get(pathname, { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["vary"]?.toLowerCase()).toContain("cookie");
    if (pathname.endsWith("/file")) {
      // Check actual Next response headers: global config can override handlers.
      expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
      expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    } else {
      expect(response.headers()["x-frame-options"]).toBe("DENY");
    }
    const result = await response.json();
    expect(result.error?.code).toBe("UNAUTHENTICATED");
    expect(result).not.toHaveProperty("data");
  }

  const submission = await request.post("/api/v1/documents", {
    headers: { Origin: baseURL! },
    multipart: { owner_id: documentId, role: "platform_admin" },
    maxRedirects: 0,
  });
  expect(submission.status()).toBe(401);
  expect(submission.headers()["cache-control"]).toContain("no-store");

  const profile = await request.patch("/api/v1/profile", {
    headers: { Origin: baseURL! },
    data: {},
    maxRedirects: 0,
  });
  expect(profile.status()).toBe(401);
  expect(profile.headers()["cache-control"]).toContain("no-store");
});

test.describe("workspace synthetic-account smoke (explicit opt-in)", () => {
  test("akun uji membuka workspace melalui login nyata tanpa mengubah dokumen", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(
      process.env.DVP_E2E_AUTH_ENABLED !== "1",
      "Requires an explicitly configured synthetic development account.",
    );
    const testEmail = process.env.DVP_E2E_AUTH_EMAIL;
    const testPassword = process.env.DVP_E2E_AUTH_PASSWORD;
    if (
      process.env.DVP_E2E_AUTH_CONFIRM !== "synthetic-development-account" ||
      !testEmail ||
      !testPassword
    ) {
      throw new Error(
        "Configure DVP_E2E_AUTH_CONFIRM=synthetic-development-account, DVP_E2E_AUTH_EMAIL and DVP_E2E_AUTH_PASSWORD. No credential values are logged.",
      );
    }

    await page.goto("/login?next=%2Fdocuments");
    await page.getByLabel(/^Email\s*\*?$/).fill(testEmail);
    await page
      .getByLabel(/^Kata sandi\s*\*?$/)
      .fill(testPassword)
      .catch(() => {
        throw new Error("Test password entry failed; credentials are omitted.");
      });
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/documents", {
      timeout: 20_000,
    });

    const identity = await page.request.get("/api/v1/me");
    expect(identity.status()).toBe(200);
    const account = await identity.json();
    expect(Boolean(account.data?.user?.emailConfirmed)).toBe(true);

    for (const [pathname, heading, screenshot] of [
      ["/dashboard", "Ringkasan", "workspace-dashboard-light.png"],
      ["/documents", "Dokumen saya", "workspace-documents-light.png"],
      ["/profile", "Profil & preferensi", "workspace-profile-light.png"],
    ]) {
      await page.goto(pathname);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath(screenshot),
        fullPage: true,
      });
    }

    await expect(page.getByLabel(/^Email\s*\*?$/)).toHaveJSProperty(
      "readOnly",
      true,
    );
    if (
      process.env.DVP_E2E_PROFILE_CHECK === "1" &&
      testInfo.project.name === "desktop"
    ) {
      const temporaryRun = process.env.DVP_E2E_TEMPORARY_RUN;
      if (
        !temporaryRun ||
        testEmail !== `dvp-workspace-${temporaryRun}@example.invalid`
      )
        throw new Error(
          "Profile writes require the helper's temporary account.",
        );
      await page
        .getByLabel("Nama lengkap", { exact: true })
        .fill("Uji Profil Development");
      await page
        .getByLabel("Nomor telepon (opsional)", { exact: true })
        .fill("0000000000");
      await page
        .getByRole("button", { name: "Simpan perubahan", exact: true })
        .click();
      await expect(
        page.getByText("Perubahan profil berhasil disimpan.", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByLabel("Nama lengkap", { exact: true }),
      ).toHaveValue("Uji Profil Development");
      await expect(
        page.getByLabel("Nomor telepon (opsional)", { exact: true }),
      ).toHaveValue("0000000000");
      const update = await page.request.patch("/api/v1/profile", {
        headers: { Origin: baseURL! },
        data: { fullName: "Uji Profil Development API" },
      });
      expect(update.status()).toBe(200);
      await page.reload();
      await expect(
        page.getByLabel("Nama lengkap", { exact: true }),
      ).toHaveValue("Uji Profil Development API");
      await expect(
        page.getByLabel("Nomor telepon (opsional)", { exact: true }),
      ).toHaveValue("0000000000");
      for (const forbidden of [
        { email: "forbidden@example.invalid" },
        { role: "platform_admin" },
        { ownerId: "10000000-0000-4000-8000-000000000001" },
      ]) {
        const rejected = await page.request.patch("/api/v1/profile", {
          headers: { Origin: baseURL! },
          data: { fullName: "Forbidden profile update", ...forbidden },
        });
        expect(rejected.status()).toBe(422);
      }
      await page.reload();
      await expect(
        page.getByLabel("Nama lengkap", { exact: true }),
      ).toHaveValue("Uji Profil Development API");
    }
    await page
      .getByRole("banner")
      .getByLabel("Tema", { exact: true })
      .selectOption("dark");
    await page.goto("/documents");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({
      path: testInfo.outputPath("workspace-documents-dark.png"),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Keluar", exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/login");
  });
});
