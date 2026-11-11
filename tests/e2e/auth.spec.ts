import { expect, test, type Page } from "@playwright/test";

// These browser checks exercise guest access with or without provider configuration.
// They never inject an authenticated fixture or substitute a backend success.
async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    "Halaman tidak boleh melebar pada viewport perangkat",
  ).toBe(false);
}

test("halaman privat mengharuskan login dan mempertahankan tujuan internal", async ({
  page,
  request,
}) => {
  for (const pathname of [
    "/dashboard",
    "/documents",
    "/submit",
    "/verify",
    "/profile",
    "/admin/overview",
    "/admin/operations",
    "/admin/review-queue",
    "/admin/review-history",
  ]) {
    await page.goto(pathname);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/login" && url.searchParams.get("next") === pathname,
    );
    await expect(
      page.getByRole("heading", { name: "Masuk ke akun Anda", exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expectNoPageOverflow(page);
  }
  await page.goto("/");
  await expect(page).toHaveURL((url) => url.pathname === "/login");

  const identity = await request.get("/api/v1/me", { maxRedirects: 0 });
  expect(identity.status()).toBe(401);
  expect(identity.headers()["cache-control"]).toContain("no-store");
  for (const pathname of ["/auth/confirm", "/auth/callback"]) {
    const response = await request.head(pathname, { maxRedirects: 0 });
    expect(response.status()).toBe(405);
    expect(response.headers()["allow"]).toBe("GET");
  }
});

test("cookie dan role yang diberikan browser tidak membuka halaman privat", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "sb-forged-auth-token",
      value: `base64-${Buffer.from(
        JSON.stringify({
          access_token: "forged-access-token",
          refresh_token: "forged-refresh-token",
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            app_metadata: { roles: ["reviewer", "platform_admin"] },
          },
        }),
      ).toString("base64url")}`,
      url: baseURL!,
    },
  ]);
  await page.setExtraHTTPHeaders({
    "x-user-id": "forged-user",
    "x-role": "platform_admin",
  });
  await page.goto("/admin/overview");
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/login" &&
      url.searchParams.get("next") === "/admin/overview",
  );
  await expect(
    page.getByRole("heading", { name: "Masuk ke akun Anda", exact: true }),
  ).toBeVisible();
});

test("form publik mengikuti konfigurasi tanpa mengirim permintaan akun atau keberhasilan palsu", async ({
  page,
}, testInfo) => {
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.hostname.endsWith(".supabase.co") ||
      /^\/(auth|rest|storage)\/v1(?:\/|$)/.test(url.pathname)
    ) {
      backendRequests.push(url.pathname);
    }
  });
  for (const [pathname, heading, submit] of [
    ["/login", "Masuk ke akun Anda", "Masuk"],
    ["/register", "Buat akun", "Buat akun"],
    ["/forgot-password", "Lupa kata sandi?", "Kirim tautan pemulihan"],
    ["/verify-email", "Periksa email Anda", "Kirim ulang email verifikasi"],
  ]) {
    await page.goto(pathname);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const configurationWarning = page.getByText(
      "Autentikasi belum dikonfigurasi",
      { exact: true },
    );
    const email = page.getByLabel(/^Email\s*\*?$/);
    const submitButton = page.getByRole("button", {
      name: submit,
      exact: true,
    });
    if (await configurationWarning.count()) {
      await expect(configurationWarning).toBeVisible();
      await expect(email).toBeDisabled();
      await expect(submitButton).toBeDisabled();
    } else {
      // Enabled controls mean configuration exists, not that delivery was verified.
      await expect(email).toBeEnabled();
      await expect(submitButton).toBeEnabled();
    }
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expectNoPageOverflow(page);
    if (pathname === "/login" || pathname === "/register") {
      await page.screenshot({
        path: testInfo.outputPath(`${pathname.slice(1)}-light.png`),
        fullPage: true,
      });
    }
  }
  await page.getByLabel("Tema", { exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/register");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Tema", { exact: true })).toHaveValue("dark");
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("register-dark.png"),
    fullPage: true,
  });
  expect(backendRequests).toEqual([]);
});

test("kontrol kata sandi memiliki label dan dapat digunakan dengan keyboard", async ({
  page,
}) => {
  await page.goto("/login");
  const password = page.getByLabel(/^Kata sandi\s*\*?$/);
  await expect(password).toHaveAttribute("type", "password");
  const reveal = page.getByRole("button", {
    name: "Tampilkan kata sandi",
    exact: true,
  });
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Sembunyikan kata sandi", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");

  await page.goto("/register");
  await expect(page.getByLabel(/^Nama lengkap\s*\*?$/)).toBeVisible();
  await expect(
    page.getByLabel(/^Konfirmasi kata sandi\s*\*?$/),
  ).toHaveAttribute("type", "password");
  await page
    .getByRole("button", {
      name: "Tampilkan konfirmasi kata sandi",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel(/^Konfirmasi kata sandi\s*\*?$/),
  ).toHaveAttribute("type", "text");
});

test("reset password membutuhkan tautan pemulihan yang sah", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Buat kata sandi baru", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Tautan pemulihan tidak tersedia", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Simpan kata sandi", exact: true }),
  ).toBeDisabled();
  await expectNoPageOverflow(page);
});

test("tujuan redirect eksternal ditolak oleh konteks form", async ({
  page,
}) => {
  for (const unsafe of [
    "https://example.invalid/",
    "//example.invalid/",
    "/\\example.invalid/",
  ]) {
    await page.goto(`/login?${new URLSearchParams({ next: unsafe })}`);
    await expect(page).toHaveURL((url) => url.pathname === "/login");
    await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
  }
});

test("alur tautan publik mempertahankan tujuan internal tanpa membocorkan query email", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fdocuments");
  await page
    .getByRole("link", { name: "Lupa kata sandi?", exact: true })
    .click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/forgot-password" &&
      url.searchParams.get("next") === "/documents",
  );
  await page.goto(
    "/verify-email?email=synthetic-private%40example.invalid&message=untrusted-query-message",
  );
  await expect(
    page.getByText("synthetic-private@example.invalid", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("untrusted-query-message", { exact: false }),
  ).toHaveCount(0);
});
