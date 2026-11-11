const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const timestampFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Belum diisi";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tidak tersedia"
    : dateFormatter.format(date);
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "Tidak tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Tidak tersedia"
    : `${timestampFormatter.format(date)} UTC`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Tidak tersedia";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024)
    return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(bytes / 1024)} KiB`;
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(bytes / (1024 * 1024))} MiB`;
}
