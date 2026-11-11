"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SigningRequest } from "./types";

/** The server still authorizes every file request. This timer also removes stale UI access. */
export function useRequestLifecycle(request: SigningRequest | null) {
  const router = useRouter();
  const [expiredKey, setExpiredKey] = useState<string | null>(null);
  const expiresAt = request?.expiresAt;
  const expiryKey = request ? `${request.id}:${request.expiresAt}` : null;
  const pending = request?.status === "pending";
  useEffect(() => {
    if (!pending || !expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    const expire = () => {
      setExpiredKey(expiryKey);
      router.refresh();
    };
    const timer = setTimeout(
      expire,
      Math.max(0, Math.min(remaining + 30, 2_147_483_647)),
    );
    const check = () => {
      if (Date.now() >= Date.parse(expiresAt)) expire();
    };
    document.addEventListener("visibilitychange", check);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [expiresAt, expiryKey, pending, router]);
  if (!request) return null;
  if (expiredKey === expiryKey && request.status === "pending") {
    return {
      ...request,
      status: "expired" as const,
      canReadFile: request.isOwner,
      documentTitle: request.isOwner ? request.documentTitle : null,
    };
  }
  return request;
}
