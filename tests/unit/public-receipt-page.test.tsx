import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m = vi.hoisted(() => ({
  read: vi.fn(),
  notFound: vi.fn(),
  session: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: m.notFound }));
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
vi.mock("@/components/theme-switcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("@/server/signing/public-metadata", () => ({
  getSigningPublicMetadata: m.read,
}));
vi.mock("@/lib/auth/session", () => ({
  requireUserWorkspace: m.session,
  requireAuthenticated: m.session,
}));
import Page from "@/app/receipts/[receiptId]/page";
import { ApiError } from "@/server/errors";
const id = "R".repeat(43);
beforeEach(() => {
  vi.resetAllMocks();
  m.notFound.mockImplementation(() => {
    throw new Error("NEXT_NOT_FOUND");
  });
});
describe("QR landing page server render", () => {
  it("renders approved metadata directly without any login requirement", async () => {
    m.read.mockResolvedValue({
      status: "approved",
      approvedAt: "2026-11-17T04:30:00.000Z",
      signerName: "Uji tanpa login",
      documentTitle: "PDF SINTETIS",
    });
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ receiptId: id }) }),
    );
    expect(html).toContain("Uji tanpa login");
    expect(html).toContain("PDF SINTETIS");
    expect(m.session).not.toHaveBeenCalled();
  });
  it("shows no success metadata when service is unavailable", async () => {
    m.read.mockRejectedValue(
      new ApiError(
        503,
        "PUBLIC_METADATA_UNAVAILABLE",
        "Metadata belum dapat dimuat.",
      ),
    );
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ receiptId: id }) }),
    );
    expect(html).toContain("Metadata belum tersedia");
    expect(html).not.toContain("Disetujui");
    expect(m.session).not.toHaveBeenCalled();
  });
  it("uses a generic not-found result for an unknown QR", async () => {
    m.read.mockResolvedValue(null);
    await expect(
      Page({ params: Promise.resolve({ receiptId: id }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.session).not.toHaveBeenCalled();
  });
});
