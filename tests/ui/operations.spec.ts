import { test, expect } from "@playwright/test";
test("labeled synthetic monitoring renders light/dark and responsive private process metadata", async ({
  page,
}, info) => {
  for (const theme of ["light", "dark"]) {
    await page.goto("/?issues=1&theme=" + theme);
    await expect(
      page.getByRole("heading", { name: "Pemantauan hasil PDF", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/UJI LOKAL · DATA SINTETIS/)).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Hasil PDF perlu perhatian",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByText("PDF belum berhasil disiapkan", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.locator(
        'a[href*="/documents"],a[href*="/receipts"],button:has-text("Setujui"),input[type="file"]',
      ),
    ).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath("monitoring-" + theme + ".png"),
      fullPage: true,
    });
  }
});
test("unavailable metrics and unavailable activity are never replaced by a misleading zero", async ({
  page,
}) => {
  await page.goto("/?unavailable=1");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Belum tersedia", { exact: true })).toHaveCount(
    6,
  );
  await expect(
    page.getByText("Tidak ada hasil yang perlu perhatian", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/?inactive-source=1");
  await expect(page.getByText("Belum tersedia", { exact: true })).toHaveCount(
    1,
  );
  await expect(
    page.getByText("Tidak ada hasil yang perlu perhatian", { exact: true }),
  ).toBeVisible();
});
