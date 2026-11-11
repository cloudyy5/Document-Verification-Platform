/** Decode only the key's declared role; Supabase still validates its signature. */
export function hasLegacyKeyRole(
  key: string,
  role: "anon" | "service_role",
): boolean {
  const parts = key.split(".");

  if (
    parts.length !== 3 ||
    parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  ) {
    return false;
  }

  try {
    const encodedPayload = parts[1]!;
    const normalizedPayload = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const payload: unknown = JSON.parse(atob(normalizedPayload));

    return (
      typeof payload === "object" &&
      payload !== null &&
      "role" in payload &&
      payload.role === role
    );
  } catch {
    return false;
  }
}

export function isSafeSupabaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(
      url.hostname,
    );

    return (
      (url.protocol === "https:" ||
        (url.protocol === "http:" && isLocalhost)) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/" || url.pathname === "")
    );
  } catch {
    return false;
  }
}

/** Include field names only: configuration errors must never echo key values. */
export function environmentError(fields: string[]): Error {
  return new Error(
    `Konfigurasi environment belum valid: ${[...new Set(fields)].join(", ")}. Periksa .env.local.`,
  );
}
