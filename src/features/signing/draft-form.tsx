"use client";

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  LoaderCircle,
  LockKeyhole,
  UploadCloud,
  X,
} from "lucide-react";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { formatFileSize } from "@/features/workspace/format";
import type { Category } from "@/features/workspace/types";
import {
  SIGNING_UPLOAD_CONSENT_TEXT,
  SIGNING_UPLOAD_POLICY_VERSION,
} from "@/lib/signing/policy";
import { cn } from "@/lib/utils";
import { isUuid, SigningClientError, signingFetch } from "./api";
import { InternalPrototypeNotice } from "./states";

type DraftReceipt = {
  documentId: string;
  versionId: string;
  versionNo: number;
};

export function SigningDraftForm({
  categories,
  maxBytes,
}: {
  categories: Category[];
  maxBytes: number;
}) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [customType, setCustomType] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [institution, setInstitution] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [needsLogin, setNeedsLogin] = useState(false);
  const [receipt, setReceipt] = useState<DraftReceipt | null>(null);
  const category = categories.find((item) => item.id === categoryId);
  const other = category?.slug === "lainnya";
  const locked = pending || receipt !== null;

  function changed() {
    key.current = null;
    setError(null);
    setFields({});
    setNeedsLogin(false);
  }

  function pickFile(selected: File | null) {
    if (locked) return;
    changed();
    let problem: string | undefined;
    if (selected) {
      if (!selected.size) problem = "File PDF tidak boleh kosong.";
      else if (selected.size > maxBytes)
        problem = `Ukuran PDF maksimal ${formatFileSize(maxBytes)}.`;
      else if (
        selected.type !== "application/pdf" ||
        !/\.pdf$/i.test(selected.name)
      )
        problem = "Pilih file PDF (.pdf).";
      else if (
        selected.name !== selected.name.trim() ||
        selected.name.length > 255 ||
        [...selected.name].some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )
      )
        problem =
          "Gunakan nama file tanpa spasi di awal/akhir dan maksimal 255 karakter.";
    }
    setFile(problem ? null : selected);
    if (problem) setFields({ file: problem });
    if (input.current) input.current.value = "";
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (locked) return;
    if (event.dataTransfer.files.length !== 1) {
      pickFile(null);
      setFields({ file: "Pilih satu file PDF untuk setiap draft." });
    } else pickFile(event.dataTransfer.files[0] ?? null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || receipt) return;
    const problems: Record<string, string> = {};
    if (!title.trim()) problems.title = "Judul dokumen wajib diisi.";
    if (!category) problems.categoryId = "Pilih kategori yang tersedia.";
    if (other && !customType.trim())
      problems.customDocumentType = "Isi jenis dokumen untuk kategori Lainnya.";
    if (!file) problems.file = "Pilih satu PDF yang valid.";
    if (!consent) problems.consent = "Persetujuan penyimpanan diperlukan.";
    if (Object.keys(problems).length || !file) {
      setFields(problems);
      setError("Lengkapi informasi dan persetujuan sebelum menyimpan draft.");
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    setFields({});
    setNeedsLogin(false);
    try {
      key.current ??= crypto.randomUUID();
      const body = new FormData();
      body.set("title", title.trim());
      body.set("categoryId", categoryId);
      body.set("file", file);
      body.set("policyVersion", SIGNING_UPLOAD_POLICY_VERSION);
      body.set("consent", "true");
      if (other) body.set("customDocumentType", customType.trim());
      if (documentDate) body.set("documentDate", documentDate);
      if (institution.trim())
        body.set("issuingInstitution", institution.trim());
      if (description.trim()) body.set("description", description.trim());
      const data = await signingFetch("/api/v2/signing-documents", {
        method: "POST",
        headers: { "Idempotency-Key": key.current },
        body,
      });
      if (
        !isUuid(data.documentId) ||
        !isUuid(data.versionId) ||
        data.versionNo !== 1 ||
        data.status !== "draft" ||
        typeof data.createdAt !== "string" ||
        !Number.isFinite(Date.parse(data.createdAt))
      )
        throw new Error("Missing draft receipt");
      const confirmed = {
        documentId: data.documentId,
        versionId: data.versionId,
        versionNo: data.versionNo,
      };
      setReceipt(confirmed);
      router.push(`/signing/documents/${confirmed.documentId}`);
      router.refresh();
    } catch (problem) {
      if (problem instanceof SigningClientError) {
        setError(problem.message);
        setFields(problem.fields);
        setNeedsLogin(problem.status === 401);
      } else
        setError(
          "Konfirmasi server belum diterima. Coba lagi tanpa mengubah isian untuk mengulangi upload yang sama, atau periksa daftar dokumen Anda.",
        );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/signing/documents"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Dokumen persetujuan
      </Link>
      <PageHeader
        eyebrow="Persetujuan internal"
        title="Buat draft privat"
        description="Simpan PDF terlebih dahulu, lalu tentukan satu penerima melalui kode pengguna."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form
          onSubmit={submit}
          onChange={changed}
          noValidate
          aria-busy={pending}
          className="panel p-4 sm:p-6"
        >
          {error && (
            <div className="mb-6">
              <AuthNotice title="Draft belum terkonfirmasi" tone="error">
                <p>{error}</p>
                {needsLogin && (
                  <Link
                    href="/login?next=%2Fsigning%2Fnew"
                    className="mt-2 inline-flex min-h-11 items-center font-medium text-primary"
                  >
                    Masuk kembali
                  </Link>
                )}
              </AuthNotice>
            </div>
          )}
          {receipt && (
            <div className="mb-6">
              <AuthNotice title="Draft telah tersimpan" tone="success">
                <p>Versi {receipt.versionNo} tersimpan secara privat.</p>
                <Link
                  href={`/signing/documents/${receipt.documentId}`}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 font-medium text-primary"
                >
                  Lanjutkan pilih penerima{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </AuthNotice>
            </div>
          )}
          <fieldset disabled={locked} className="min-w-0 space-y-7">
            <div>
              <h2 className="section-heading">1. File dokumen</h2>
              <div
                className={cn(
                  "mt-4 rounded-lg border border-dashed px-5 py-8 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary-soft"
                    : "border-border-strong bg-muted/40",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!locked) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={dropFile}
              >
                <UploadCloud
                  className="mx-auto mb-3 size-8 text-primary"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <p className="text-sm font-medium">Tarik satu PDF ke sini</p>
                <p className="mt-2 text-xs text-subtle">
                  Maksimal {formatFileSize(maxBytes)} · PDF tanpa password
                </p>
                <input
                  ref={input}
                  id={`${id}-file`}
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Pilih PDF draft"
                  className="sr-only"
                  onChange={(event) =>
                    pickFile(event.target.files?.[0] ?? null)
                  }
                />
                <Button
                  variant="secondary"
                  className="mt-4"
                  onClick={() => input.current?.click()}
                >
                  Pilih file PDF
                </Button>
              </div>
              {file && (
                <div className="mt-3 flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                  <FileText
                    className="size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-medium">{file.name}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus PDF terpilih"
                    onClick={() => pickFile(null)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
              {fields.file && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {fields.file}
                </p>
              )}
            </div>
            <div>
              <h2 className="mb-4 section-heading">2. Informasi dokumen</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Judul dokumen"
                  required
                  maxLength={200}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  error={fields.title}
                />
                <div className="space-y-2">
                  <label
                    htmlFor={`${id}-category`}
                    className="block text-[13px] font-medium"
                  >
                    Kategori <span className="text-danger">*</span>
                  </label>
                  <select
                    id={`${id}-category`}
                    required
                    value={categoryId}
                    aria-invalid={Boolean(fields.categoryId)}
                    aria-describedby={
                      fields.categoryId ? `${id}-category-error` : undefined
                    }
                    onChange={(event) => {
                      setCategoryId(event.target.value);
                      setCustomType("");
                    }}
                    className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
                  >
                    <option value="">Pilih kategori</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fields.categoryId && (
                    <p
                      id={`${id}-category-error`}
                      role="alert"
                      className="text-xs text-danger"
                    >
                      {fields.categoryId}
                    </p>
                  )}
                </div>
                {other && (
                  <Input
                    label="Jenis dokumen"
                    required
                    value={customType}
                    onChange={(event) => setCustomType(event.target.value)}
                    maxLength={120}
                    error={fields.customDocumentType}
                  />
                )}
                <Input
                  label="Tanggal dokumen (opsional)"
                  type="date"
                  value={documentDate}
                  onChange={(event) => setDocumentDate(event.target.value)}
                  error={fields.documentDate}
                />
                <Input
                  label="Instansi penerbit (opsional)"
                  maxLength={200}
                  value={institution}
                  onChange={(event) => setInstitution(event.target.value)}
                  error={fields.issuingInstitution}
                />
                <div className="space-y-2 sm:col-span-2">
                  <label
                    htmlFor={`${id}-description`}
                    className="block text-[13px] font-medium"
                  >
                    Deskripsi (opsional)
                  </label>
                  <textarea
                    id={`${id}-description`}
                    rows={3}
                    maxLength={2000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    aria-invalid={Boolean(fields.description)}
                    className="w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
                  />
                  {fields.description && (
                    <p role="alert" className="text-xs text-danger">
                      {fields.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-border pt-5">
              <h2 className="mb-3 section-heading">
                3. Izin penyimpanan development
              </h2>
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  aria-invalid={Boolean(fields.consent)}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
                />
                <span>{SIGNING_UPLOAD_CONSENT_TEXT}</span>
              </label>
              {fields.consent && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {fields.consent}
                </p>
              )}
              <div className="mt-6 flex justify-end border-t border-border pt-5">
                <Button
                  type="submit"
                  className="w-full sm:w-auto"
                  disabled={!categories.length}
                >
                  {pending ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : (
                    <LockKeyhole aria-hidden="true" />
                  )}
                  {pending ? "Menyimpan draft…" : "Simpan draft privat"}
                </Button>
              </div>
            </div>
          </fieldset>
        </form>
        <aside className="space-y-5">
          <section className="panel p-5">
            <h2 className="section-heading">Dari draft ke permintaan</h2>
            <ol className="mt-4 space-y-4 text-xs leading-6 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">
                  1. Simpan secara privat.
                </span>
                <br />
                Unggah satu PDF sintetis tanpa password.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  2. Temukan penerima.
                </span>
                <br />
                Masukkan kode lengkap dan pastikan nama akun yang ditampilkan.
              </li>
              <li>
                <span className="font-medium text-foreground">
                  3. Beri izin berbagi.
                </span>
                <br />
                Penerima memperoleh akses ke versi ini selama permintaan aktif.
              </li>
            </ol>
          </section>
          <InternalPrototypeNotice />
        </aside>
      </div>
    </div>
  );
}
