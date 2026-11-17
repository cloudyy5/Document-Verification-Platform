import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
const receipt = "A".repeat(43),
  origin = "http://127.0.0.1:3204";
const bytes = Buffer.from("%PDF-1.7\nSYNTHETIC LOCAL HASH COMPARISON\n");
const hash = createHash("sha256").update(bytes).digest("hex");
async function proof(page: Page, status = 200, artifactHash = "b".repeat(64)) {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      calls.push(request.method());
  });
  await page.route("**/api/v2/signing-receipts/**", async (route) => {
    await route.fulfill({
      status,
      json:
        status === 200
          ? {
              data: {
                id: receipt,
                requestId: "98000000-0000-4000-8000-000000000001",
                documentTitle: "PDF SINTETIS ARSIP",
                ownerName: "Penguji A",
                signerName: "Penguji B",
                sourceSha256: hash,
                decidedAt: "2026-11-16T01:00:00Z",
                artifact: { state: "ready", sha256: artifactHash },
              },
            }
          : { error: { code: "NOT_FOUND" } },
    });
  });
  return calls;
}
test("overview and archive documents remain distinct from legacy in both themes", async ({
  page,
}, info) => {
  for (const theme of ["light", "dark"]) {
    await page.goto(`/?view=overview&theme=${theme}`);
    await expect(
      page.getByRole("heading", { name: "Ringkasan arsip" }),
    ).toBeVisible();
    await expect(
      page.getByText("PDF SINTETIS ARSIP", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => window.document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`archive-overview-${theme}.png`),
      fullPage: true,
    });
    await page.goto(`/?view=list&theme=${theme}`);
    await expect(
      page.getByRole("link", { name: "Lihat riwayat" }),
    ).toHaveAttribute("href", /^\/signing\/documents\//);
    await expect(
      page.getByRole("link", { name: "Pengajuan lama", exact: true }),
    ).toHaveAttribute("href", "/documents/legacy");
    await page.goto(`/?view=legacy&theme=${theme}`);
    await expect(
      page.getByRole("heading", { name: "Pengajuan lama", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("PDF SINTETIS ARSIP", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveAttribute(
      "action",
      "/documents/legacy",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`previous-applications-${theme}.png`),
      fullPage: true,
    });
    await page.goto(`/?view=administrative&empty=1&theme=${theme}`);
    await expect(
      page.getByRole("heading", { name: "Pengajuan administratif lama" }),
    ).toBeVisible();
    await expect(page.locator("form")).toHaveAttribute(
      "action",
      "/documents/administrative",
    );
  }
  await page.goto("/?view=overview&failed=1");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Belum tersedia", { exact: true })).toHaveCount(
    8,
  );
});
test("completed signing history is available even with no administrative submissions", async ({
  page,
}) => {
  await page.goto("/?view=legacy");
  await expect(
    page.getByRole("heading", { name: "Pengajuan lama", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("completed");
  await expect(page.getByRole("combobox").locator("option")).toHaveCount(4);
  await expect(
    page.getByRole("link", { name: "Lihat riwayat" }),
  ).toHaveAttribute("href", /^\/requests\//);
  await expect(
    page.getByRole("link", {
      name: "Arsip pemeriksaan terdahulu",
      exact: true,
    }),
  ).toHaveAttribute("href", "/documents/administrative");
});
test("received rejected history keeps private metadata hidden and preserves pagination context", async ({
  page,
}) => {
  await page.goto("/?view=legacy&scope=received&status=rejected");
  await expect(
    page.getByText("Informasi dokumen tidak tersedia", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("PDF SINTETIS ARSIP", { exact: true }),
  ).toHaveCount(0);
  const href = await page
    .getByRole("link", { name: "Berikutnya", exact: true })
    .getAttribute("href");
  const target = new URL(href!, origin);
  expect(target.pathname).toBe("/documents/legacy");
  expect(target.searchParams.get("scope")).toBe("received");
  expect(target.searchParams.get("status")).toBe("rejected");
  expect(target.searchParams.get("cursor")).toBe("syntheticcursor");
  await expect(
    page.getByRole("link", { name: "Pernah saya kirim", exact: true }),
  ).toHaveAttribute("href", "/documents/legacy?scope=sent&status=rejected");
});
test("administrative records keep their own status and original detail route", async ({
  page,
}) => {
  await page.goto("/?view=administrative");
  await expect(
    page
      .getByRole("link", {
        name: "PENGAJUAN ADMINISTRATIF SINTETIS",
        exact: true,
      })
      .first(),
  ).toHaveAttribute("href", "/documents/98000000-0000-4000-8000-000000000003");
  await expect(page.locator("form")).toHaveAttribute(
    "action",
    "/documents/administrative",
  );
});
test("sent and received archive filters retain scope and status when paging", async ({
  page,
}) => {
  for (const scope of ["sent", "received"]) {
    await page.goto(`/?view=${scope}`);
    await expect(page.getByRole("combobox")).toHaveValue("completed");
    await expect(
      page.getByRole("link", { name: "Lihat riwayat" }),
    ).toHaveAttribute("href", /^\/requests\//);
    const next = page.getByRole("link", { name: "Berikutnya", exact: true });
    const target = new URL((await next.getAttribute("href"))!, origin);
    expect(target.searchParams.get("scope")).toBe(scope);
    expect(target.searchParams.get("status")).toBe("completed");
    expect(target.searchParams.get("cursor")).toBe("syntheticcursor");
    await expect(page.locator('input[name="scope"]')).toHaveValue(scope);
  }
});
test("private ID/link checks reject other origins and user codes without requesting them", async ({
  page,
}) => {
  const calls = await proof(page);
  await page.goto("/");
  await page.getByRole("button", { name: "ID bukti", exact: true }).click();
  const input = page.getByLabel("ID atau tautan bukti persetujuan", {
    exact: true,
  });
  await input.fill(`https://attacker.example/receipts/${receipt}`);
  await page
    .getByRole("button", { name: "Periksa bukti", exact: true })
    .click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(calls).toHaveLength(0);
  await input.fill("DVP-0123456789ABCDEF0123");
  await page
    .getByRole("button", { name: "Periksa bukti", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Kode pengguna bukan ID bukti",
  );
  await input.fill(`${origin}/receipts/${receipt}`);
  await page
    .getByRole("button", { name: "Periksa bukti", exact: true })
    .click();
  await expect(
    page.getByText("Bukti persetujuan ditemukan", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Buka bukti privat" }),
  ).toHaveAttribute("href", `/receipts/${receipt}`);
});
test("QR image is decoded locally and only the private evidence GET is sent", async ({
  page,
}) => {
  const calls = await proof(page);
  await page.goto("/");
  const image = await QRCode.toBuffer(`${origin}/receipts/${receipt}`, {
    width: 512,
    margin: 4,
  });
  await page.getByLabel("Gambar QR", { exact: true }).setInputFiles({
    name: "synthetic-qr.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByText("Bukti persetujuan ditemukan", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(["GET"]);
});
test("PDF comparison reads exact bytes locally and distinguishes a mismatch", async ({
  page,
}) => {
  const calls = await proof(page);
  await page.goto("/");
  await page.getByRole("button", { name: "File PDF", exact: true }).click();
  await page
    .getByLabel("ID atau tautan bukti persetujuan", { exact: true })
    .fill(receipt);
  const file = page.getByLabel("PDF untuk dibandingkan", { exact: true });
  await file.setInputFiles({
    name: "synthetic.pdf",
    mimeType: "application/pdf",
    buffer: bytes,
  });
  await page
    .getByRole("button", { name: "Cocokkan file PDF", exact: true })
    .click();
  await expect(
    page.getByText("File cocok dengan PDF sumber", { exact: true }),
  ).toBeVisible();
  await file.setInputFiles({
    name: "changed.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([bytes, Buffer.from("changed")]),
  });
  await page
    .getByRole("button", { name: "Cocokkan file PDF", exact: true })
    .click();
  await expect(
    page.getByText("File tidak cocok dengan bukti ini", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(["GET", "GET"]);
});
test("inaccessible evidence stays a generic denial without a positive result", async ({
  page,
}) => {
  await proof(page, 404);
  await page.goto("/");
  await page
    .getByLabel("ID atau tautan bukti persetujuan", { exact: true })
    .fill(receipt);
  await page
    .getByRole("button", { name: "Periksa bukti", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "tidak ditemukan atau akun Anda tidak memiliki akses",
  );
  await expect(
    page.getByRole("status", { name: "Hasil pemeriksaan" }),
  ).toHaveCount(0);
});
test("exact result PDF bytes are distinguished from the approved source", async ({
  page,
}) => {
  const calls = await proof(page, 200, hash);
  await page.goto("/");
  await page.getByRole("button", { name: "File PDF", exact: true }).click();
  await page
    .getByLabel("ID atau tautan bukti persetujuan", { exact: true })
    .fill(receipt);
  await page
    .getByLabel("PDF untuk dibandingkan", { exact: true })
    .setInputFiles({
      name: "synthetic-result.pdf",
      mimeType: "application/pdf",
      buffer: bytes,
    });
  await page
    .getByRole("button", { name: "Cocokkan file PDF", exact: true })
    .click();
  await expect(
    page.getByText("File cocok dengan PDF hasil persetujuan", { exact: true }),
  ).toBeVisible();
  expect(calls).toEqual(["GET"]);
});
test("camera is opt-in and stops its synthetic tracks when changing method", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = window as unknown as {
      cameraStarts: number;
      cameraStops: number;
    };
    state.cameraStarts = 0;
    state.cameraStops = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: async () => {
        state.cameraStarts++;
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const media = canvas.captureStream(1);
        const track = media.getTracks()[0]!,
          stop = track.stop.bind(track);
        track.stop = () => {
          state.cameraStops++;
          stop();
        };
        return media;
      },
    });
  });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => (window as unknown as { cameraStarts: number }).cameraStarts,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Gunakan kamera", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Hentikan kamera" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ID bukti", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { cameraStops: number }).cameraStops,
      ),
    )
    .toBeGreaterThan(0);
});
