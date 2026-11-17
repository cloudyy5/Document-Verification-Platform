import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { PublicSigningMetadataView } from "../../../src/features/signing/public-metadata-view";
import "../../../src/app/globals.css";
createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="data-theme" defaultTheme="light">
    <PublicSigningMetadataView
      receiptId={"R".repeat(43)}
      metadata={{
        status: "approved",
        approvedAt: "2026-11-17T04:30:00.000Z",
        signerName: "Penerima Sintetis — Uji Lokal",
        documentTitle:
          "UJI DEVELOPMENT: Dokumen persetujuan sintetis untuk menguji pemindaian QR tanpa login",
      }}
    />
  </ThemeProvider>,
);
