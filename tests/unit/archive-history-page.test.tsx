import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ guard: vi.fn(), requests: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUserWorkspace: mocks.guard }));
vi.mock("@/server/signing/queries", () => ({
  getSigningRequests: mocks.requests,
}));
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
import HistoryPage from "@/app/(user)/documents/legacy/page";
import { ApiError } from "@/server/errors";

const id = "98000000-0000-4000-8000-000000000001";
const request = {
  id,
  documentId: id,
  sourceVersionId: "98000000-0000-4000-8000-000000000002",
  ownerName: "Penguji A",
  recipientName: "Penguji B",
  documentTitle: "UJI RIWAYAT PERSETUJUAN",
  status: "completed",
  sentAt: "2026-11-16T01:00:00Z",
  expiresAt: "2026-11-23T01:00:00Z",
  cancelledAt: null,
  isOwner: true,
  canReadFile: true,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.guard.mockResolvedValue(undefined);
  mocks.requests.mockResolvedValue({
    items: [request],
    hasMore: false,
    cursor: null,
  });
});
const page = (input: Record<string, string | string[] | undefined> = {}) =>
  HistoryPage({ searchParams: Promise.resolve(input) });

describe("previous applications read the current private signing history", () => {
  it("defaults to completed sent requests instead of the old administrative tables", async () => {
    const html = renderToStaticMarkup(await page());
    expect(mocks.guard).toHaveBeenCalledWith("/documents/legacy");
    expect(mocks.requests).toHaveBeenCalledExactlyOnceWith({
      scope: "sent",
      status: "completed",
    });
    expect(html).toContain("UJI RIWAYAT PERSETUJUAN");
    expect(html).toContain(`href="/requests/${id}"`);
    expect(html).toContain('href="/documents/administrative"');
  });
  it.each(["completed", "rejected", "cancelled", "expired"])(
    "preserves the received scope for terminal status %s",
    async (status) => {
      await page({ scope: "received", status });
      expect(mocks.requests).toHaveBeenCalledExactlyOnceWith({
        scope: "received",
        status,
      });
    },
  );
  it("opens received history for a recipient with no sent completed requests", async () => {
    mocks.requests.mockResolvedValueOnce({
      items: [],
      hasMore: false,
      cursor: null,
    });
    mocks.requests.mockResolvedValueOnce({
      items: [{ ...request, isOwner: false }],
      hasMore: false,
      cursor: null,
    });
    const html = renderToStaticMarkup(await page());
    expect(mocks.requests).toHaveBeenNthCalledWith(1, {
      scope: "sent",
      status: "completed",
    });
    expect(mocks.requests).toHaveBeenNthCalledWith(2, {
      scope: "received",
      status: "completed",
    });
    expect(html).toContain('name="scope" value="received"');
    expect(html).toContain("UJI RIWAYAT PERSETUJUAN");
  });
  it("does not change an explicitly selected empty sent scope", async () => {
    mocks.requests.mockResolvedValue({
      items: [],
      hasMore: false,
      cursor: null,
    });
    const html = renderToStaticMarkup(await page({ scope: "sent" }));
    expect(mocks.requests).toHaveBeenCalledTimes(1);
    expect(html).toContain("Belum ada riwayat untuk pilihan ini");
  });
  it.each([
    { status: "pending" },
    { status: "consented" },
    { status: "approved" },
    { scope: "owned" },
    { user_id: id },
    { status: ["completed", "rejected"] },
  ])(
    "rejects active or foreign-authority history filters %j before reading",
    async (input) => {
      const html = renderToStaticMarkup(await page(input));
      expect(html).toContain("Filter riwayat tidak valid");
      expect(mocks.requests).not.toHaveBeenCalled();
    },
  );
  it("authenticates before reading even with invalid query parameters", async () => {
    const redirect = new Error("Login redirect");
    mocks.guard.mockRejectedValue(redirect);
    await expect(page({ status: "pending" })).rejects.toBe(redirect);
    expect(mocks.requests).not.toHaveBeenCalled();
  });
  it("keeps unavailable data distinct from an empty history", async () => {
    mocks.requests.mockRejectedValue(
      new ApiError(503, "SIGNING_UNAVAILABLE", "Unavailable"),
    );
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Layanan belum dapat digunakan");
    expect(html).not.toContain("Belum ada riwayat untuk pilihan ini");
  });
  it("offers filter recovery for a malformed decoded cursor", async () => {
    mocks.requests.mockRejectedValue(
      new ApiError(422, "VALIDATION_ERROR", "Invalid cursor"),
    );
    const html = renderToStaticMarkup(await page({ cursor: "invalidcursor" }));
    expect(html).toContain("Filter riwayat tidak valid");
    expect(html).toContain('href="/documents/legacy"');
  });
  it("does not recreate a source title already hidden from a recipient", async () => {
    mocks.requests.mockResolvedValue({
      items: [
        {
          ...request,
          documentTitle: null,
          status: "rejected",
          isOwner: false,
          canReadFile: false,
        },
      ],
      hasMore: false,
      cursor: null,
    });
    const html = renderToStaticMarkup(
      await page({ scope: "received", status: "rejected" }),
    );
    expect(html).toContain("Informasi dokumen tidak tersedia");
    expect(html).not.toContain("UJI RIWAYAT PERSETUJUAN");
  });
});
