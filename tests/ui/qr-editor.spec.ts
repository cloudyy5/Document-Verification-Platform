import { test, expect } from "@playwright/test";
import type { QrPosition } from "../../src/lib/signing/placement";
test("drag or touch, keyboard, independent pages and copy all keep positions inside the real PDF preview", async ({
  page,
  context,
}, info) => {
  await page.goto("/");
  const add = page.getByRole("button", {
    name: "Letakkan penanda QR",
    exact: true,
  });
  await expect(add).toBeEnabled({ timeout: 30000 });
  await expect(page.getByTestId("placement-value")).toHaveText("null");
  await expect(
    page.getByRole("img", { name: "QR tautan bukti persetujuan privat" }),
  ).toHaveCount(0);
  await add.click();
  const marker = page.getByRole("button", { name: /Posisi QR halaman 1/ });
  const before = await marker.boundingBox(),
    sheet = await page.getByTestId("qr-page-sheet").boundingBox();
  if (!before || !sheet) throw new Error("Preview not measurable");
  const x = before.x + before.width / 2,
    y = before.y + before.height / 2;
  if (info.project.name === "mobile") {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + sheet.width * 0.1, y: y + sheet.height * 0.04 }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + sheet.width * 0.1, y + sheet.height * 0.04, {
      steps: 6,
    });
    await page.mouse.up();
  }
  const after = await marker.boundingBox();
  expect(after!.x - before.x).toBeCloseTo(sheet.width * 0.1, 0);
  await marker.focus();
  await marker.press("ArrowLeft");
  const keyboard = await marker.boundingBox();
  expect(after!.x - keyboard!.x).toBeCloseTo(sheet.width * 0.005, 0);
  await page
    .getByRole("button", { name: "Halaman berikutnya", exact: true })
    .click();
  await expect(add).toBeEnabled();
  await add.click();
  await page
    .getByRole("button", { name: /Posisi QR halaman 2/ })
    .press("ArrowRight");
  await page
    .getByRole("button", { name: "Gunakan di semua halaman", exact: true })
    .click();
  await expect(page.getByTestId("placement-value")).not.toHaveText("null");
  const positions = JSON.parse(
    (await page.getByTestId("placement-value").textContent())!,
  ) as QrPosition[];
  expect(positions).toHaveLength(4);
  expect(positions.map((item) => item.page)).toEqual([1, 2, 3, 4]);
  expect(
    positions.every(
      (item) => item.x >= 0 && item.y >= 0 && item.x < 1 && item.y < 1,
    ),
  ).toBe(true);
  await expect(
    page.getByText("4 dari 4 halaman sudah diatur", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByText("Memuat halaman…", { exact: true })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Hapus posisi", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath("qr-editor.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hapus posisi", exact: true }).click();
  await expect(page.getByTestId("placement-value")).toHaveText("null");
});
test("mismatched source hash keeps all approval positions unavailable", async ({
  page,
}) => {
  await page.goto("/?bad-hash=1");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("placement-value")).toHaveText("null");
  await expect(
    page.getByRole("button", { name: "Letakkan penanda QR", exact: true }),
  ).toHaveCount(0);
});
