"use client";

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileText,
  Info,
  LoaderCircle,
  RotateCcw,
  Send,
  UploadCloud,
  X,
} from "lucide-react";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { DocumentStatusBadge } from "./document-status";
import { formatFileSize, formatTimestamp } from "./format";
import { developmentConsentText } from "./submission-policy";
import type { Category, DocumentDetail, SubmissionVersion } from "./types";

type Field =
  | "title"
  | "categoryId"
  | "customDocumentType"
  | "file"
  | "documentDate"
  | "issuingInstitution"
  | "description"
  | "consent"
  | "policyVersion";
type FieldErrors = Partial<Record<Field, string>>;
type Receipt = {
  documentId: string;
  submissionId: string;
  versionNo: number;
  status: SubmissionVersion["status"];
  submittedAt: string;
};
const fields: readonly Field[] = [
  "title",
  "categoryId",
  "customDocumentType",
  "file",
  "documentDate",
  "issuingInstitution",
  "description",
  "consent",
  "policyVersion",
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function receiptFrom(value: unknown): Receipt | null {
  if (!object(value) || !object(value.data)) return null;
  const data = value.data;
  if (
    typeof data.documentId !== "string" ||
    !uuid.test(data.documentId) ||
    typeof data.submissionId !== "string" ||
    !uuid.test(data.submissionId) ||
    typeof data.versionNo !== "number" ||
    !Number.isSafeInteger(data.versionNo) ||
    data.versionNo < 1 ||
    (data.status !== "pending_review" &&
      data.status !== "approved" &&
      data.status !== "revision_requested" &&
      data.status !== "rejected") ||
    typeof data.submittedAt !== "string" ||
    !Number.isFinite(Date.parse(data.submittedAt))
  )
    return null;
  return {
    documentId: data.documentId,
    submissionId: data.submissionId,
    versionNo: data.versionNo,
    status: data.status,
    submittedAt: data.submittedAt,
  };
}

export function SubmissionForm({
  categories,
  configuration,
  document,
}: {
  categories: Category[];
  configuration: { maxBytes: number; policyVersion: string };
  document?: DocumentDetail;
}) {
  const router = useRouter();
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const pendingRequest = useRef(false);
  const [title, setTitle] = useState(document?.title ?? "");
  const [categoryId, setCategoryId] = useState(document?.category.id ?? "");
  const [customDocumentType, setCustomDocumentType] = useState(
    document?.customDocumentType ?? "",
  );
  const [documentDate, setDocumentDate] = useState(
    document?.documentDate ?? "",
  );
  const [issuingInstitution, setIssuingInstitution] = useState(
    document?.issuingInstitution ?? "",
  );
  const [description, setDescription] = useState(document?.description ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const category = categories.find((item) => item.id === categoryId);
  const other = category?.slug === "lainnya";
  const locked = pending || receipt !== null;
  const ready = Boolean(
    title.trim() &&
    category &&
    (!other || customDocumentType.trim()) &&
    file &&
    consent,
  );

  function changed(field: Field) {
    idempotencyKey.current = null;
    setMessage(null);
    setNeedsLogin(false);
    setErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function pickFile(selected: File | null) {
    if (locked) return;
    changed("file");
    let error: string | undefined;
    if (selected) {
      if (!selected.size) error = "File PDF tidak boleh kosong.";
      else if (selected.size > configuration.maxBytes)
        error = `Ukuran file maksimal ${formatFileSize(configuration.maxBytes)}.`;
      else if (
        selected.type !== "application/pdf" ||
        !/\.pdf$/i.test(selected.name)
      )
        error = "Pilih file dengan format PDF (.pdf).";
      else if (
        selected.name.length > 255 ||
        [...selected.name].some(
          (character) =>
            character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )
      )
        error = "Gunakan nama file yang valid dan tidak melebihi 255 karakter.";
    }
    setFile(error ? null : selected);
    if (error) setErrors((previous) => ({ ...previous, file: error }));
    if (fileInput.current) fileInput.current.value = "";
  }

  function dropFile(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (locked) return;
    if (event.dataTransfer.files.length !== 1) {
      pickFile(null);
      setErrors((previous) => ({
        ...previous,
        file: "Pilih satu file PDF untuk setiap pengajuan.",
      }));
      return;
    }
    pickFile(event.dataTransfer.files[0] ?? null);
  }

  function reset() {
    if (locked) return;
    setTitle(document?.title ?? "");
    setCategoryId(document?.category.id ?? "");
    setCustomDocumentType(document?.customDocumentType ?? "");
    setDocumentDate(document?.documentDate ?? "");
    setIssuingInstitution(document?.issuingInstitution ?? "");
    setDescription(document?.description ?? "");
    setConsent(false);
    setFile(null);
    setErrors({});
    setMessage(null);
    setNeedsLogin(false);
    idempotencyKey.current = null;
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRequest.current || receipt) return;
    const validation: FieldErrors = {};
    if (!title.trim()) validation.title = "Nama dokumen wajib diisi.";
    if (!category)
      validation.categoryId = "Pilih kategori dokumen yang tersedia.";
    if (other && !customDocumentType.trim())
      validation.customDocumentType =
        "Isi jenis dokumen untuk kategori Lainnya.";
    if (!file) validation.file = "Pilih file PDF yang valid.";
    if (!consent)
      validation.consent = "Persetujuan aktif diperlukan sebelum pengajuan.";
    if (Object.keys(validation).length || !file) {
      setErrors(validation);
      setMessage("Lengkapi field wajib sebelum mengajukan dokumen.");
      return;
    }
    pendingRequest.current = true;
    setPending(true);
    setMessage(null);
    setErrors({});
    setNeedsLogin(false);
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const body = new FormData();
      body.set("title", title.trim());
      body.set("categoryId", categoryId);
      body.set("file", file);
      if (other) body.set("customDocumentType", customDocumentType.trim());
      if (documentDate) body.set("documentDate", documentDate);
      if (issuingInstitution.trim())
        body.set("issuingInstitution", issuingInstitution.trim());
      if (description.trim()) body.set("description", description.trim());
      body.set("policyVersion", configuration.policyVersion);
      body.set("consent", "true");
      const endpoint = document
        ? `/api/v1/documents/${encodeURIComponent(document.id)}/resubmissions`
        : "/api/v1/documents";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        credentials: "same-origin",
        cache: "no-store",
        body,
        signal: AbortSignal.timeout(120_000),
      });
      let result: unknown = null;
      try {
        result = await response.json();
      } catch {
        /* A missing JSON receipt is never treated as success. */
      }
      if (!response.ok) {
        const error =
          object(result) && object(result.error) ? result.error : null;
        const errorMessage =
          error && typeof error.message === "string"
            ? error.message
            : response.status === 401
              ? "Sesi Anda tidak tersedia. Silakan masuk kembali."
              : "Pengajuan belum dapat diproses. Silakan coba kembali.";
        const fieldErrors: FieldErrors = {};
        if (error && Array.isArray(error.fields))
          for (const item of error.fields) {
            if (
              object(item) &&
              typeof item.field === "string" &&
              fields.includes(item.field as Field) &&
              typeof item.message === "string"
            )
              fieldErrors[item.field as Field] = item.message;
          }
        if (
          !fieldErrors.file &&
          (response.status === 413 ||
            (error &&
              typeof error.code === "string" &&
              [
                "INVALID_FILE",
                "FILE_TOO_LARGE",
                "UNSUPPORTED_FILE_TYPE",
                "INVALID_PDF",
                "ENCRYPTED_PDF",
                "ACTIVE_PDF",
                "PDF_PROCESSING_LIMIT",
              ].includes(error.code)))
        )
          fieldErrors.file = errorMessage;
        setErrors(fieldErrors);
        setMessage(errorMessage);
        setNeedsLogin(response.status === 401);
        return;
      }
      const confirmed = receiptFrom(result);
      if (!confirmed || (document && confirmed.documentId !== document.id)) {
        setMessage(
          "Server belum memberikan bukti pengajuan yang dapat ditampilkan. Periksa daftar dokumen sebelum mencoba kembali.",
        );
        return;
      }
      setReceipt(confirmed);
      router.push(
        `/documents/${confirmed.documentId}?submission=${confirmed.submissionId}`,
      );
      router.refresh();
    } catch {
      setMessage(
        "Konfirmasi dari server belum diterima. Coba kembali tanpa mengubah isian untuk mengulangi permintaan yang sama, atau periksa daftar dokumen Anda.",
      );
    } finally {
      pendingRequest.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User workspace"
        title={document ? "Revisi dokumen" : "Ajukan dokumen"}
        description={
          document
            ? "Kirim PDF dan metadata versi baru tanpa menimpa pengajuan sebelumnya."
            : "Ajukan PDF dan informasi dokumen untuk pemeriksaan administratif."
        }
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={submit}
          noValidate
          aria-busy={pending}
          className="panel p-4 sm:p-6"
        >
          {receipt && (
            <div className="mb-6">
              <AuthNotice title="Pengajuan tersimpan" tone="success">
                <p>
                  Versi {receipt.versionNo} telah diterima pada{" "}
                  {formatTimestamp(receipt.submittedAt)}.
                </p>
                <p className="mt-2 break-all font-mono text-xs">
                  {receipt.submissionId}
                </p>
                <div className="mt-3">
                  <DocumentStatusBadge status={receipt.status} />
                </div>
                <Link
                  href={`/documents/${receipt.documentId}?submission=${receipt.submissionId}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 font-medium text-primary"
                >
                  Lihat detail pengajuan{" "}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </AuthNotice>
            </div>
          )}
          {message && (
            <div className="mb-6">
              <AuthNotice title="Pengajuan belum dikonfirmasi" tone="error">
                <p>{message}</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {needsLogin && (
                    <Link
                      href={`/login?next=${encodeURIComponent(document ? `/documents/${document.id}/resubmit` : "/submit")}`}
                      className="inline-flex min-h-11 items-center text-xs font-medium text-primary"
                    >
                      Masuk kembali
                    </Link>
                  )}
                  <Link
                    href="/documents"
                    className="inline-flex min-h-11 items-center text-xs font-medium text-primary"
                  >
                    Lihat daftar dokumen
                  </Link>
                </div>
              </AuthNotice>
            </div>
          )}
          {!categories.length && (
            <div className="mb-6">
              <AuthNotice title="Kategori belum tersedia">
                Pengajuan belum dapat diproses karena tidak ada kategori aktif
                yang dapat dipilih.
              </AuthNotice>
            </div>
          )}
          <p className="mb-5 text-xs text-subtle">
            Field bertanda * wajib diisi.
          </p>
          <fieldset disabled={locked} className="min-w-0 space-y-7">
            <legend className="sr-only">
              File PDF dan informasi pengajuan
            </legend>
            <section aria-labelledby={`${id}-file-heading`}>
              <h2 id={`${id}-file-heading`} className="section-heading mb-4">
                1. File PDF{" "}
                <span className="text-danger" aria-hidden="true">
                  *
                </span>
              </h2>
              {document && (
                <p className="mb-4 text-xs leading-6 text-muted-foreground">
                  Versi saat ini: {document.currentVersionNo}. Pilih PDF untuk
                  versi baru; file sebelumnya tidak dipakai ulang secara
                  otomatis.
                </p>
              )}
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!locked) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={dropFile}
                className={cn(
                  "rounded-lg border border-dashed px-4 py-7 text-center transition-colors",
                  dragging
                    ? "border-primary bg-primary-soft"
                    : "border-border-strong bg-muted/40",
                  errors.file && "border-danger",
                )}
              >
                <UploadCloud
                  size={32}
                  strokeWidth={1.5}
                  className="mx-auto mb-3 text-primary"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium">
                  Pilih atau tarik satu file PDF ke sini
                </p>
                <p
                  id={`${id}-file-hint`}
                  className="mt-2 text-xs leading-5 text-subtle"
                >
                  Maksimal {formatFileSize(configuration.maxBytes)} · PDF tanpa
                  enkripsi/password
                </p>
                <input
                  ref={fileInput}
                  id={`${id}-file`}
                  name="file"
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="File PDF"
                  aria-required="true"
                  aria-describedby={`${id}-file-hint${errors.file ? ` ${id}-file-error` : ""}`}
                  aria-invalid={Boolean(errors.file)}
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) pickFile(selected);
                  }}
                  className="sr-only"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4"
                  onClick={() => fileInput.current?.click()}
                >
                  {file ? "Ganti file PDF" : "Pilih file PDF"}
                </Button>
              </div>
              {file && (
                <div className="mt-3 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                  <FileText
                    size={20}
                    className="mt-1 shrink-0 text-subtle"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {formatFileSize(file.size)} · Dipilih, belum disimpan
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus file yang dipilih"
                    onClick={() => pickFile(null)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              )}
              {errors.file && (
                <p
                  id={`${id}-file-error`}
                  role="alert"
                  className="mt-2 text-xs leading-5 text-danger"
                >
                  {errors.file}
                </p>
              )}
            </section>
            <section
              className="space-y-5 border-t border-border pt-6"
              aria-labelledby={`${id}-metadata-heading`}
            >
              <h2 id={`${id}-metadata-heading`} className="section-heading">
                2. Informasi dokumen
              </h2>
              <Input
                label="Nama dokumen"
                name="title"
                required
                maxLength={200}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  changed("title");
                }}
                error={errors.title}
              />
              <div className="space-y-2">
                <label
                  htmlFor={`${id}-category`}
                  className="block text-[13px] font-medium"
                >
                  Kategori dokumen{" "}
                  <span className="text-danger" aria-hidden="true">
                    *
                  </span>
                </label>
                <select
                  id={`${id}-category`}
                  name="categoryId"
                  required
                  value={categoryId}
                  aria-invalid={Boolean(errors.categoryId)}
                  aria-describedby={
                    errors.categoryId ? `${id}-category-error` : undefined
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    setCategoryId(value);
                    changed("categoryId");
                    if (
                      categories.find((item) => item.id === value)?.slug !==
                      "lainnya"
                    ) {
                      setCustomDocumentType("");
                      changed("customDocumentType");
                    }
                  }}
                  className={cn(
                    "min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm disabled:opacity-60",
                    errors.categoryId && "border-danger",
                  )}
                >
                  <option value="">Pilih kategori</option>
                  {categoryId && !category && (
                    <option value={categoryId} disabled>
                      Kategori lama tidak aktif — pilih kategori lain
                    </option>
                  )}
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {errors.categoryId && (
                  <p
                    id={`${id}-category-error`}
                    role="alert"
                    className="text-xs text-danger"
                  >
                    {errors.categoryId}
                  </p>
                )}
              </div>
              {other && (
                <Input
                  label="Jenis dokumen"
                  name="customDocumentType"
                  required
                  maxLength={120}
                  value={customDocumentType}
                  onChange={(event) => {
                    setCustomDocumentType(event.target.value);
                    changed("customDocumentType");
                  }}
                  error={errors.customDocumentType}
                  hint="Jelaskan jenis dokumen untuk kategori Lainnya."
                />
              )}
              <Input
                label="Tanggal dokumen (opsional)"
                name="documentDate"
                type="date"
                value={documentDate}
                onChange={(event) => {
                  setDocumentDate(event.target.value);
                  changed("documentDate");
                }}
                error={errors.documentDate}
              />
              <Input
                label="Instansi penerbit (opsional)"
                name="issuingInstitution"
                maxLength={200}
                value={issuingInstitution}
                onChange={(event) => {
                  setIssuingInstitution(event.target.value);
                  changed("issuingInstitution");
                }}
                error={errors.issuingInstitution}
              />
              <div className="space-y-2">
                <label
                  htmlFor={`${id}-description`}
                  className="block text-[13px] font-medium"
                >
                  Deskripsi (opsional)
                </label>
                <textarea
                  id={`${id}-description`}
                  name="description"
                  rows={4}
                  maxLength={2000}
                  value={description}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={
                    errors.description ? `${id}-description-error` : undefined
                  }
                  onChange={(event) => {
                    setDescription(event.target.value);
                    changed("description");
                  }}
                  className={cn(
                    "w-full resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm disabled:opacity-60",
                    errors.description && "border-danger",
                  )}
                />
                {errors.description && (
                  <p
                    id={`${id}-description-error`}
                    role="alert"
                    className="text-xs text-danger"
                  >
                    {errors.description}
                  </p>
                )}
              </div>
            </section>
            <section
              className="border-t border-border pt-6"
              aria-labelledby={`${id}-consent-heading`}
            >
              <h2 id={`${id}-consent-heading`} className="section-heading mb-4">
                3. Persetujuan pengajuan
              </h2>
              <label
                htmlFor={`${id}-consent`}
                className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6"
              >
                <input
                  id={`${id}-consent`}
                  name="consent"
                  type="checkbox"
                  required
                  checked={consent}
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={
                    errors.consent ? `${id}-consent-error` : undefined
                  }
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    changed("consent");
                  }}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>{developmentConsentText}</span>
              </label>
              <Link
                href="/policies/submission"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-primary"
              >
                Baca kebijakan pengajuan development{" "}
                <ArrowRight size={15} className="ml-2" aria-hidden="true" />
              </Link>
              <p className="mt-1 text-xs leading-5 text-subtle">
                Versi {configuration.policyVersion}. Pengujian development
                menggunakan dokumen sintetis.
              </p>
              {errors.consent && (
                <p
                  id={`${id}-consent-error`}
                  role="alert"
                  className="mt-2 text-xs text-danger"
                >
                  {errors.consent}
                </p>
              )}
              {errors.policyVersion && (
                <p role="alert" className="mt-2 text-xs text-danger">
                  {errors.policyVersion}
                </p>
              )}
            </section>
            <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
              <Button type="button" variant="ghost" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Reset isian
              </Button>
              <Button type="submit" disabled={!ready || locked}>
                {pending ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Send aria-hidden="true" />
                )}
                {pending
                  ? "Memproses pengajuan…"
                  : document
                    ? "Ajukan versi baru"
                    : "Ajukan dokumen"}
              </Button>
            </div>
          </fieldset>
          <p role="status" className="mt-3 text-xs leading-5 text-subtle">
            {pending
              ? "Server sedang memvalidasi PDF dan menyimpan pengajuan. Tunggu konfirmasi sebelum meninggalkan halaman."
              : !ready && !receipt
                ? "Lengkapi nama dokumen, kategori, PDF, dan persetujuan untuk mengajukan."
                : ""}
          </p>
        </form>
        <aside className="space-y-5">
          <section className="panel p-5">
            <h2 className="section-heading">Alur pengajuan</h2>
            <ol className="mt-5 space-y-5">
              {[
                {
                  title: "Validasi teknis",
                  text: "Format, ukuran, struktur PDF, dan SHA-256 diperiksa oleh server.",
                },
                {
                  title: "Pemeriksaan administratif",
                  text: "Reviewer memeriksa kelengkapan, keterbacaan, kesesuaian kategori, dan kelayakan pendaftaran.",
                },
                {
                  title: "Keputusan review",
                  text: "Ikuti status dan catatan keputusan dari detail dokumen Anda.",
                },
              ].map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs text-muted-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">{step.title}</h3>
                    <p className="mt-1 text-xs leading-6 text-subtle">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel p-5">
            <h2 className="section-heading">Syarat file</h2>
            <ul className="mt-4 space-y-3 text-xs leading-6 text-muted-foreground">
              {[
                "Format PDF (.pdf) yang dapat diproses",
                `Maksimal ${formatFileSize(configuration.maxBytes)}`,
                "Tanpa enkripsi atau password",
                "Gunakan dokumen sintetis untuk development",
              ].map((text) => (
                <li key={text} className="flex items-start gap-2">
                  <Check
                    size={15}
                    className="mt-1 shrink-0 text-subtle"
                    aria-hidden="true"
                  />
                  {text}
                </li>
              ))}
            </ul>
          </section>
          <p className="flex items-start gap-2 px-1 text-xs leading-6 text-subtle">
            <Info size={16} className="mt-1 shrink-0" aria-hidden="true" />
            Persetujuan tidak menjamin keaslian penerbit atau keabsahan hukum.
            Kode dan QR aktif hanya diterbitkan setelah dokumen disetujui.
          </p>
        </aside>
      </div>
    </div>
  );
}
