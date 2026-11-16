import { test, expect, type Page } from "@playwright/test";
import type { NotificationItem } from "../../src/lib/notifications/schema";

function item(index: number): NotificationItem {
  return {
    id: `95000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    title:
      index === 1
        ? "Permintaan persetujuan baru"
        : "Tanggapan permintaan tercatat",
    body: "Pesan generik dari fixture sintetis tanpa data pribadi.",
    targetPath: "/requests/96000000-0000-4000-8000-000000000001",
    createdAt: "2026-11-16T03:00:00Z",
    readAt: null,
  };
}
async function feed(page: Page, length = 2) {
  const state = {
    rows: Array.from({ length }, (_, n) => item(n + 1)),
    status: 200,
    failRead: false,
    readStatus: 200,
    writes: 0,
    reads: 0,
  };
  await page.route("**/api/v1/notifications**", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      expect(request.postDataJSON()).toEqual({});
      state.writes++;
      if (state.readStatus !== 200) {
        await route.fulfill({
          status: state.readStatus,
          json: { error: { code: "UNAUTHENTICATED" } },
        });
        return;
      }
      if (state.failRead) {
        await route.fulfill({
          status: 503,
          json: { error: { code: "NOTIFICATIONS_UNAVAILABLE" } },
        });
        return;
      }
      const id = new URL(request.url()).pathname.split("/").at(-2);
      const row = state.rows.find((entry) => entry.id === id)!;
      row.readAt ??= "2026-11-16T04:00:00Z";
      await route.fulfill({ json: { data: { id, readAt: row.readAt } } });
      return;
    }
    state.reads++;
    if (state.status !== 200) {
      await route.fulfill({
        status: state.status,
        json: { error: { code: "UNAVAILABLE" } },
      });
      return;
    }
    const older = new URL(request.url()).searchParams.has("cursor");
    const rows = older ? state.rows.slice(20) : state.rows.slice(0, 20);
    await route.fulfill({
      json: {
        data: {
          items: rows,
          unreadCount: state.rows.filter((row) => !row.readAt).length,
          hasMore: !older && state.rows.length > 20,
          nextCursor: !older && state.rows.length > 20 ? "b2xkZXI" : null,
        },
      },
    });
  });
  return state;
}

test("bell shows actual unread items, marks read and restores keyboard focus in both themes", async ({
  page,
}, info) => {
  const state = await feed(page);
  for (const theme of ["light", "dark"]) {
    state.rows.forEach((row) => {
      row.readAt = null;
    });
    await page.goto("/?theme=" + theme);
    const bell = page.getByRole("button", {
      name: "Buka notifikasi, 2 belum dibaca",
      exact: true,
    });
    await bell.click();
    const dialog = page.getByRole("dialog", {
      name: "Notifikasi",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", { name: "Permintaan persetujuan baru" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Buka dokumen" }).first(),
    ).toHaveAttribute("href", state.rows[0]!.targetPath!);
    await dialog
      .getByRole("button", {
        name: "Tandai dibaca: Permintaan persetujuan baru",
        exact: true,
      })
      .click();
    await expect(
      dialog.getByText("1 belum dibaca", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("Sudah dibaca", { exact: true })).toHaveCount(
      1,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("notifications-" + theme + ".png"),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Buka notifikasi, 1 belum dibaca",
        exact: true,
      }),
    ).toBeFocused();
  }
  expect(state.writes).toBe(2);
});

test("failed reads are never displayed as an empty notification list", async ({
  page,
}) => {
  const state = await feed(page);
  state.status = 503;
  await page.goto("/");
  await page
    .getByRole("button", { name: "Buka notifikasi", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Notifikasi belum dapat dimuat",
  );
  await expect(
    page.getByText("Belum ada notifikasi", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("0 belum dibaca", { exact: true })).toHaveCount(
    0,
  );
  state.status = 200;
  await page.getByRole("button", { name: "Perbarui", exact: true }).click();
  await expect(page.getByText("2 belum dibaca", { exact: true })).toBeVisible();
});

test("failed mark-read keeps the item unread until a successful retry", async ({
  page,
}) => {
  const state = await feed(page);
  state.failRead = true;
  await page.goto("/");
  await page.getByRole("button", { name: /Buka notifikasi/ }).click();
  const button = page.getByRole("button", {
    name: "Tandai dibaca: Permintaan persetujuan baru",
    exact: true,
  });
  await button.click();
  await expect(page.getByRole("alert")).toContainText(
    "Status dibaca belum dapat disimpan",
  );
  expect(state.rows[0]!.readAt).toBeNull();
  state.failRead = false;
  await button.click();
  await expect(page.getByText("1 belum dibaca", { exact: true })).toBeVisible();
});

test("pagination adds older items and expired sessions clear cached private items", async ({
  page,
}) => {
  const state = await feed(page, 21);
  await page.goto("/");
  await page.getByRole("button", { name: /Buka notifikasi/ }).click();
  await expect(page.getByRole("article")).toHaveCount(20);
  await page.getByRole("button", { name: "Muat lebih banyak" }).click();
  await expect(page.getByRole("article")).toHaveCount(21);
  state.status = 401;
  await page.getByRole("button", { name: "Perbarui", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Sesi Anda telah berakhir",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
});

test("unread badge refreshes periodically while the tab is visible", async ({
  page,
}) => {
  await page.clock.install();
  const state = await feed(page);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Buka notifikasi, 2 belum dibaca" }),
  ).toBeVisible();
  state.rows.push(item(3));
  await page.clock.fastForward(31_000);
  await expect(
    page.getByRole("button", { name: "Buka notifikasi, 3 belum dibaca" }),
  ).toBeVisible();
});

test("expired sessions during mark-read also clear cached private items", async ({
  page,
}) => {
  const state = await feed(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Buka notifikasi/ }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  state.readStatus = 401;
  await page
    .getByRole("button", {
      name: "Tandai dibaca: Permintaan persetujuan baru",
      exact: true,
    })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Sesi Anda telah berakhir",
  );
  await expect(page.getByRole("article")).toHaveCount(0);
});
