import { test, expect } from "@playwright/test";
test("metadata is readable without login or file access, in light and dark layouts", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Persetujuan tercatat", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Penerima Sintetis — Uji Lokal", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Disetujui", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/UJI DEVELOPMENT: Dokumen persetujuan sintetis/),
  ).toBeVisible();
  await expect(
    page.locator(
      "form,input[type=password],iframe,object,embed,input[type=file]",
    ),
  ).toHaveCount(0);
  const link = page.getByRole("link", {
    name: "Buka dokumen sebagai peserta",
    exact: true,
  });
  await expect(link).toHaveAttribute(
    "href",
    `/receipts/${"R".repeat(43)}/details`,
  );
  for (const theme of ["light", "dark"]) {
    await page
      .getByRole("combobox", { name: "Tema", exact: true })
      .selectOption(theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`public-metadata-${theme}.png`),
      fullPage: true,
    });
  }
});
