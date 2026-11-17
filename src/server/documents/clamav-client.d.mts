export function clamavScan(
  bytes: Uint8Array,
  options: { host: string; port: number; timeoutMs: number },
): Promise<"clean" | "infected">;
