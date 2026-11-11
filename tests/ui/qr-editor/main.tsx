import { useState } from "react";
import { createRoot } from "react-dom/client";
import Editor from "../../../src/features/signing/qr-placement-editor";
import type { QrPosition } from "../../../src/lib/signing/placement";
import "../../../src/app/globals.css";
const fixture = (await fetch("/fixture.json").then((response) =>
  response.json(),
)) as { sourceUrl: string; sha256: string };
function Harness() {
  const [positions, setPositions] = useState<QrPosition[] | null>(null);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-subtle">
          Uji lokal · Data sintetis
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Penempatan QR penerima</h1>
      </div>
      <Editor
        sourceUrl={fixture.sourceUrl}
        sourceSha256={
          new URLSearchParams(location.search).has("bad-hash")
            ? "f".repeat(64)
            : fixture.sha256
        }
        onChange={setPositions}
      />
      <output data-testid="placement-value" className="block break-all text-xs">
        {JSON.stringify(positions)}
      </output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
