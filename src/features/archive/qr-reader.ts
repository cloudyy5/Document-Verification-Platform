import jsQR from "jsqr";
export function decodeQrCanvas(canvas: HTMLCanvasElement): string | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Pemrosesan gambar tidak tersedia.");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  return (
    jsQR(pixels.data, pixels.width, pixels.height, {
      inversionAttempts: "attemptBoth",
    })?.data ?? null
  );
}
export async function decodeQrImage(file: File): Promise<string> {
  if (
    !file.size ||
    file.size > 5 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("Pilih PNG, JPEG, atau WebP maksimal 5 MiB.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const value = decodeQrCanvas(canvas);
    if (!value)
      throw new Error(
        "QR belum terbaca. Gunakan gambar yang jelas dan tidak terpotong.",
      );
    return value;
  } finally {
    bitmap.close();
  }
}
