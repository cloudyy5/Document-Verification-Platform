import "server-only";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";

const appUrlSchema = z.url().refine((value) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
});

const flowSecretSchema = z.string().min(32).max(512);

/** Canonical origin checks and logout do not need privileged auth settings. */
export function getAppOrigin(): string {
  const result = appUrlSchema.safeParse(process.env.APP_URL);
  if (!result.success)
    throw new Error("Layanan autentikasi belum dikonfigurasi.");
  return new URL(result.data).origin;
}

export function getAuthConfiguration() {
  getPublicEnv();
  getServerEnv();
  const appOrigin = getAppOrigin();
  const result = flowSecretSchema.safeParse(process.env.AUTH_FLOW_SECRET);
  if (!result.success)
    throw new Error("Layanan autentikasi belum dikonfigurasi.");
  return {
    appOrigin,
    flowSecret: result.data,
  };
}

export function isAuthConfigured(): boolean {
  try {
    getAuthConfiguration();
    return true;
  } catch {
    return false;
  }
}
