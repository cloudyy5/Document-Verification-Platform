"use client";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Move,
  Plus,
  ScanLine,
  LoaderCircle,
  Copy,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  QR_SIDE_PT,
  MAX_SIGNING_PAGES,
  clampPosition,
  positionFits,
  type QrPage,
  type QrPosition,
} from "@/lib/signing/placement";

export default function QrPlacementEditor({
  sourceUrl,
  sourceSha256,
  disabled = false,
  onChange,
}: {
  sourceUrl: string;
  sourceSha256: string;
  disabled?: boolean;
  onChange: (value: QrPosition[] | null) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null),
    [pages, setPages] = useState<QrPage[]>([]),
    [positions, setPositions] = useState<(QrPosition | null)[]>([]),
    [pageIndex, setPageIndex] = useState(0),
    [zoom, setZoom] = useState(1),
    [width, setWidth] = useState(600),
    [busy, setBusy] = useState(true),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    sheet = useRef<HTMLDivElement>(null),
    notify = useRef(onChange),
    drag = useRef<{
      pointer: number;
      x: number;
      y: number;
      position: QrPosition;
    } | null>(null);
  useEffect(() => {
    notify.current = onChange;
  }, [onChange]);
  useEffect(() => {
    notify.current(
      !error &&
        pages.length > 0 &&
        positions.length === pages.length &&
        positions.every(
          (item, index) => item && positionFits(pages[index]!, item),
        )
        ? (positions as QrPosition[])
        : null,
    );
  }, [positions, pages, error]);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const value = entries[0]?.contentRect.width;
      if (value) setWidth(Math.max(180, Math.min(850, value - 32)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true,
      task: PDFDocumentLoadingTask | undefined;
    const controller = new AbortController();
    async function load() {
      try {
        const url = new URL(sourceUrl, window.location.origin);
        if (
          url.origin !== window.location.origin ||
          !/^\/api\/v2\/signing-documents\/[a-f0-9-]{36}\/file$/.test(
            url.pathname,
          )
        )
          throw new Error("Invalid source");
        const response = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
        });
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/pdf") ||
          Number(response.headers.get("content-length")) > 10485760 ||
          !response.body
        )
          throw new Error("PDF unavailable");
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let length = 0;
        try {
          for (;;) {
            const next = await reader.read();
            if (next.done) break;
            length += next.value.byteLength;
            if (length > 10485760) throw new Error("PDF too large");
            chunks.push(next.value);
          }
        } finally {
          void reader.cancel().catch(() => {});
          reader.releaseLock();
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        const digest = [
          ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        ]
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
        if (digest !== sourceSha256) throw new Error("Source mismatch");
        const library = await import("pdfjs-dist"),
          assets = `/pdfjs/${library.version}/`;
        library.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
        task = library.getDocument({
          data: bytes,
          cMapUrl: `${assets}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`,
          iccUrl: `${assets}iccs/`,
          enableXfa: false,
          stopAtErrors: true,
          canvasMaxAreaInBytes: 16777216,
          verbosity: 0,
        });
        const document = await task.promise;
        if (document.numPages < 1 || document.numPages > MAX_SIGNING_PAGES)
          throw new Error("Unsupported pages");
        const geometry: QrPage[] = [];
        for (let index = 1; index <= document.numPages; index++) {
          if (!active) return;
          const page = await document.getPage(index),
            viewport = page.getViewport({ scale: 1 }),
            rotation = ((page.rotate % 360) + 360) % 360;
          if (
            ![0, 90, 180, 270].includes(rotation) ||
            ![viewport.width, viewport.height, page.userUnit].every(
              Number.isFinite,
            ) ||
            viewport.width < 90 ||
            viewport.height < 90 ||
            viewport.width > 14400 ||
            viewport.height > 14400 ||
            page.userUnit < 0.01 ||
            page.userUnit > 100
          )
            throw new Error("Unsupported geometry");
          geometry.push({
            page: index,
            widthPt: Math.round(viewport.width * 1e6) / 1e6,
            heightPt: Math.round(viewport.height * 1e6) / 1e6,
            rotation: rotation as QrPage["rotation"],
            userUnit: page.userUnit,
          });
          page.cleanup();
        }
        if (active) {
          setPages(geometry);
          setPositions(geometry.map(() => null));
          setPdf(document);
        }
      } catch {
        if (active) {
          setError(
            "PDF belum dapat ditampilkan untuk mengatur QR. Muat ulang dan periksa kembali akses dokumen Anda.",
          );
          setBusy(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      void task?.destroy().catch(() => {});
    };
  }, [sourceUrl, sourceSha256]);
  const page = pages[pageIndex],
    position = positions[pageIndex] ?? null,
    ready = positions.filter(Boolean).length;
  const shownWidth = width * zoom,
    shownHeight = page ? (shownWidth * page.heightPt) / page.widthPt : 600;
  useEffect(() => {
    if (!pdf || !page || !canvas.current) return;
    let active = true,
      renderTask:
        | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
        | undefined;
    setBusy(true);
    void pdf
      .getPage(page.page)
      .then(async (source) => {
        if (!active || !canvas.current) return;
        const scale = shownWidth / page.widthPt,
          ratio = Math.min(
            window.devicePixelRatio || 1,
            2,
            Math.sqrt(4000000 / (shownWidth * shownHeight)),
          );
        const viewport = source.getViewport({ scale: scale * ratio });
        canvas.current.width = Math.floor(viewport.width);
        canvas.current.height = Math.floor(viewport.height);
        renderTask = source.render({ canvas: canvas.current, viewport });
        await renderTask.promise;
        if (active) setBusy(false);
      })
      .catch(() => {
        if (active) {
          setError(
            "Halaman PDF belum dapat ditampilkan. Muat ulang untuk mencoba kembali.",
          );
          setBusy(false);
        }
      });
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pdf, page, shownWidth, shownHeight]);
  function update(value: QrPosition | null) {
    if (disabled) return;
    setNotice(null);
    setPositions((current) =>
      current.map((item, index) => (index === pageIndex ? value : item)),
    );
  }
  function pointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!position || disabled || busy) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      position,
    };
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current,
      rect = sheet.current?.getBoundingClientRect();
    if (
      !start ||
      !rect ||
      !page ||
      start.pointer !== event.pointerId ||
      disabled
    )
      return;
    update(
      clampPosition(
        page,
        start.position.x + (event.clientX - start.x) / rect.width,
        start.position.y + (event.clientY - start.y) / rect.height,
      ),
    );
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    if (!page || !position || disabled) return;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.02 : 0.005;
    update(
      clampPosition(
        page,
        position.x + direction[0] * step,
        position.y + direction[1] * step,
      ),
    );
  }
  function copyAll() {
    if (!position || disabled) return;
    const next = pages.map((item) =>
      positionFits(item, position) ? { ...position, page: item.page } : null,
    );
    setPositions(next);
    setNotice(
      next.some((item) => !item)
        ? "Halaman yang ukurannya berbeda masih perlu diatur satu per satu."
        : "Posisi diterapkan ke semua halaman. Periksa penempatan sebelum menyetujui.",
    );
  }
  return (
    <section
      className="panel overflow-hidden"
      aria-labelledby="qr-placement-title"
    >
      <div className="border-b border-border p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <ScanLine className="size-5 text-primary" aria-hidden="true" />
          <h2 id="qr-placement-title" className="section-heading">
            Atur posisi QR
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Letakkan penanda pada area kosong di setiap halaman. Geser dengan
          mouse atau sentuhan; gunakan tombol panah untuk penyesuaian.
        </p>
        <p role="status" className="mt-3 text-xs font-medium text-primary">
          {pages.length
            ? `${ready} dari ${pages.length} halaman sudah diatur`
            : "Menyiapkan pratinjau PDF…"}
        </p>
      </div>
      {error ? (
        <p role="alert" className="p-5 text-sm leading-6 text-danger">
          {error}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Halaman sebelumnya"
                disabled={disabled || busy || pageIndex === 0}
                onClick={() => setPageIndex((value) => value - 1)}
              >
                <ChevronLeft />
              </Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Halaman
                <input
                  aria-label="Nomor halaman PDF"
                  className="w-14 rounded border border-border bg-surface p-2 text-center text-foreground"
                  type="number"
                  min={1}
                  max={pages.length || 1}
                  value={pageIndex + 1}
                  disabled={disabled || busy}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (
                      Number.isInteger(value) &&
                      value >= 1 &&
                      value <= pages.length
                    )
                      setPageIndex(value - 1);
                  }}
                />
                / {pages.length || "—"}
              </label>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Halaman berikutnya"
                disabled={disabled || busy || pageIndex >= pages.length - 1}
                onClick={() => setPageIndex((value) => value + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Tampilan
              <select
                aria-label="Perbesaran PDF"
                disabled={disabled || busy}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="min-h-11 rounded border border-border bg-surface px-2 text-foreground"
              >
                <option value={1}>Pas lebar</option>
                <option value={1.5}>150%</option>
                <option value={2}>200%</option>
              </select>
            </label>
          </div>
          <div
            ref={container}
            className="relative overflow-auto bg-muted p-4"
            style={{ maxHeight: "72vh", minHeight: 300 }}
          >
            <div
              ref={sheet}
              data-testid="qr-page-sheet"
              className="relative mx-auto bg-white shadow-sm"
              style={{ width: shownWidth, height: shownHeight }}
            >
              <canvas
                ref={canvas}
                role="img"
                aria-label={`Pratinjau PDF halaman ${pageIndex + 1}`}
                className="block h-full w-full"
              />
              {position && page && (
                <button
                  type="button"
                  aria-label={`Posisi QR halaman ${page.page}. Gunakan tombol panah untuk menggeser.`}
                  disabled={disabled || busy}
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={() => {
                    drag.current = null;
                  }}
                  onPointerCancel={() => {
                    drag.current = null;
                  }}
                  onKeyDown={keyboard}
                  className="absolute flex touch-none select-none flex-col items-center justify-center border-2 border-dashed border-primary bg-primary/10 text-primary outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
                  style={{
                    left: `${position.x * 100}%`,
                    top: `${position.y * 100}%`,
                    width: `${(QR_SIDE_PT / page.widthPt) * 100}%`,
                    height: `${(QR_SIDE_PT / page.heightPt) * 100}%`,
                    cursor: disabled ? "default" : "grab",
                  }}
                >
                  <Move className="size-5" aria-hidden="true" />
                  <span className="mt-1 text-[10px] font-semibold leading-tight">
                    Posisi QR
                  </span>
                </button>
              )}
              {busy && (
                <div
                  role="status"
                  className="absolute inset-0 flex items-center justify-center gap-2 bg-white/90 text-sm text-slate-600"
                >
                  <LoaderCircle
                    className="size-5 animate-spin"
                    aria-hidden="true"
                  />
                  Memuat halaman…
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3 border-t border-border p-4 sm:p-5">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={disabled || busy || !page}
                onClick={() => {
                  if (page)
                    update(
                      clampPosition(
                        page,
                        (1 - QR_SIDE_PT / page.widthPt) / 2,
                        (1 - QR_SIDE_PT / page.heightPt) / 2,
                      ),
                    );
                }}
              >
                <Plus aria-hidden="true" />
                {position ? "Posisikan di tengah" : "Letakkan penanda QR"}
              </Button>
              <Button
                variant="ghost"
                disabled={disabled || busy || !position}
                onClick={() => update(null)}
              >
                <Trash2 aria-hidden="true" />
                Hapus posisi
              </Button>
              {pages.length > 1 && (
                <Button
                  variant="ghost"
                  disabled={disabled || busy || !position}
                  onClick={copyAll}
                >
                  <Copy aria-hidden="true" />
                  Gunakan di semua halaman
                </Button>
              )}
            </div>
            <p className="text-xs leading-6 text-subtle">
              Penanda ini hanya menunjukkan posisi. QR diterbitkan setelah
              persetujuan tercatat; posisinya kemudian dikunci. Bukti
              persetujuan tersedia di web, tanpa halaman PDF tambahan.
            </p>
            {notice && (
              <p role="status" className="text-xs leading-6 text-primary">
                {notice}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
