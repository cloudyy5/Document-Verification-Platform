import { expect, test, type Page } from "@playwright/test";

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow, "Konten tidak boleh menyebabkan halaman melebar").toBe(
    false,
  );
}

test("showcase publik tetap berupa komponen lokal tanpa operasi dokumen", async ({
  page,
}, testInfo) => {
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.hostname.endsWith(".supabase.co") ||
      /^\/(auth|rest|storage)\/v1(?:\/|$)/.test(url.pathname) ||
      url.pathname.startsWith("/api/")
    ) {
      backendRequests.push(url.pathname);
    }
  });

  await page.goto("/foundation");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expectNoPageOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("foundation-light.png"),
    fullPage: true,
  });

  expect(backendRequests).toEqual([]);
});

test("tema tersimpan lintas halaman dan mengikuti perubahan sistem", async ({
  page,
}, testInfo) => {
  await page.goto("/foundation");
  const themeSelect = page.getByLabel("Tema", { exact: true });
  await expect(themeSelect).toBeEnabled();

  await themeSelect.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themeSelect).toHaveValue("dark");
  await page.screenshot({
    path: testInfo.outputPath("login-dark.png"),
    fullPage: true,
  });

  await themeSelect.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await themeSelect.selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("dialog mengelola fokus dan notifikasi dapat ditutup", async ({
  page,
}) => {
  await page.goto("/foundation");
  await expect(page.getByLabel("Nama komponen", { exact: true })).toBeVisible();
  const trigger = page.getByRole("button", {
    name: "Buka contoh modal",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Contoh dialog",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog
    .getByRole("button", { name: "Tutup dialog", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page
    .getByRole("button", { name: "Tampilkan notifikasi", exact: true })
    .click();
  const notification = page
    .getByRole("status")
    .filter({ hasText: "Notifikasi contoh" });
  await expect(notification).toBeVisible();
  await notification
    .getByRole("button", {
      name: "Tutup notifikasi: Notifikasi contoh",
      exact: true,
    })
    .click();
  await expect(notification).toBeHidden();
  await expectNoPageOverflow(page);
});

test("drawer mobile dapat dibuka dengan keyboard dan mengembalikan fokus", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Drawer khusus viewport mobile",
  );
  await page.goto("/foundation");
  const trigger = page.getByRole("button", {
    name: "Buka navigasi",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  expect(
    await drawer.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});
