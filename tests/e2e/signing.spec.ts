import { expect, test } from "@playwright/test";

// Guest checks only: no account, file upload, invitation or provider substitution.
test.use({ trace: "off", screenshot: "off" });

const documentId = "10000000-0000-4000-8000-000000000001";
const versionId = "10000000-0000-4000-8000-000000000002";
const requestId = "10000000-0000-4000-8000-000000000003";
const receiptId = "R".repeat(43);

test("halaman persetujuan internal meminta login dengan tujuan yang tepat", async ({
  page,
}) => {
  for (const path of [
    "/signing/documents",
    "/signing/new",
    `/signing/documents/${documentId}`,
    "/requests/incoming",
    "/requests/outgoing",
    `/requests/${requestId}`,
    `/receipts/${receiptId}`,
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === "/login" && url.searchParams.get("next") === path,
    );
    await expect(
      page.getByRole("heading", { name: "Masuk ke akun Anda", exact: true }),
    ).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false);
  }
});

test("API persetujuan internal menolak guest tanpa membaca dokumen", async ({
  request,
  baseURL,
}) => {
  for (const path of [
    "/api/v2/me/user-code",
    "/api/v2/operations/metrics",
    "/api/v2/signing-documents",
    `/api/v2/signing-documents/${documentId}`,
    `/api/v2/signing-documents/${documentId}/file?versionId=${versionId}`,
    "/api/v2/signing-requests?scope=received",
    "/api/v2/signing-requests?scope=sent",
    `/api/v2/signing-requests/${requestId}`,
    `/api/v2/signing-requests/${requestId}/decision`,
    `/api/v2/signing-receipts/${receiptId}`,
    `/api/v2/signing-receipts/${receiptId}/file`,
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["vary"]?.toLowerCase()).toContain("cookie");
    const body = await response.json();
    expect(body.error?.code).toBe("UNAUTHENTICATED");
    expect(body).not.toHaveProperty("data");
  }
  for (const [path, data] of [
    ["/api/v2/recipients/lookup", { code: "DVP-00000000000000000000" }],
    [
      "/api/v2/signing-requests",
      {
        sourceVersionId: versionId,
        recipientId: documentId,
        recipientCode: "DVP-00000000000000000000",
        sharingConsent: true,
      },
    ],
    [`/api/v2/signing-requests/${requestId}/cancel`, {}],
    [
      `/api/v2/signing-requests/${requestId}/decisions`,
      { action: "approve", confirmed: true },
    ],
    [`/api/v2/signing-receipts/${receiptId}/render`, {}],
  ] as const) {
    const response = await request.post(path, {
      headers: { Origin: baseURL! },
      data,
      maxRedirects: 0,
    });
    expect(response.status()).toBe(401);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect((await response.json()).error?.code).toBe("UNAUTHENTICATED");
  }
  const upload = await request.post("/api/v2/signing-documents", {
    headers: { Origin: baseURL! },
    multipart: { owner_id: documentId, role: "platform_admin" },
    maxRedirects: 0,
  });
  expect(upload.status()).toBe(401);
  expect(upload.headers()["cache-control"]).toContain("no-store");
});

test("shortcut keputusan tanpa kontrak versi tidak membuka akses", async ({
  request,
  baseURL,
}) => {
  // Legacy shortcut routes stay absent; decisions require the bound contract.
  for (const action of ["approve", "reject", "sign", "qr"]) {
    const response = await request.post(
      `/api/v2/signing-requests/${requestId}/${action}`,
      {
        headers: { Origin: baseURL! },
        data: {},
        maxRedirects: 0,
      },
    );
    expect([401, 404, 405]).toContain(response.status());
    expect(response.status()).not.toBeGreaterThanOrEqual(500);
  }
});
