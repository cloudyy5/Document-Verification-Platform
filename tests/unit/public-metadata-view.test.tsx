import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/theme-switcher", () => ({ ThemeSwitcher: () => null }));
vi.mock("next/link", () => ({
  default: (props: React.ComponentProps<"a">) => <a {...props} />,
}));
import { PublicSigningMetadataView } from "@/features/signing/public-metadata-view";
describe("public metadata output", () => {
  it("renders only the whitelist values and leaves the PDF behind the participant link", () => {
    const html = renderToStaticMarkup(
      <PublicSigningMetadataView
        receiptId={"R".repeat(43)}
        metadata={{
          status: "approved",
          approvedAt: "2026-11-17T04:30:00.000Z",
          signerName: "Penerima sintetis",
          documentTitle: "UJI DEVELOPMENT",
        }}
      />,
    );
    expect(html).toContain("Penerima sintetis");
    expect(html).toContain("UJI DEVELOPMENT");
    expect(html).toContain("Disetujui");
    expect(html).toContain(`/receipts/${"R".repeat(43)}/details`);
    expect(html).not.toMatch(
      /<iframe|<object|<embed|<form|href="[^"\s]*(?:\.pdf|\/file|storage|supabase)/i,
    );
  });
  it("escapes potentially hostile signer/title text instead of executing it", () => {
    const html = renderToStaticMarkup(
      <PublicSigningMetadataView
        receiptId={"R".repeat(43)}
        metadata={{
          status: "approved",
          approvedAt: "2026-11-17T04:30:00.000Z",
          signerName: "<script>alert(1)</script>",
          documentTitle: '<img src=x onerror="alert(1)">',
        }}
      />,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
  });
});
