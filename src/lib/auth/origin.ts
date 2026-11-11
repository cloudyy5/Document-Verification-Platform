/** Exact canonical origin, never derived from untrusted forwarded headers. */
export function isAllowedAuthOrigin(
  origin: string | null,
  appOrigin: string,
): boolean {
  return origin !== null && origin === appOrigin;
}
