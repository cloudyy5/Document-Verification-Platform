import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthConfiguration } from "@/lib/auth/config";
import { issueRecoveryGrant } from "@/lib/auth/recovery";
import { clearLocalAuthCookies } from "@/lib/auth/cookies";

function finish(path: string) {
  let origin: string;
  try {
    origin = getAuthConfiguration().appOrigin;
  } catch {
    return new NextResponse("Layanan autentikasi sementara tidak tersedia.", {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  }
  const response = NextResponse.redirect(new URL(path, origin), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (
    !tokenHash ||
    !/^[A-Za-z0-9_-]{32,2048}$/.test(tokenHash) ||
    (type !== "signup" && type !== "recovery")
  )
    return finish("/login?error=invalid_link");
  try {
    getAuthConfiguration();
    const client = await createSupabaseServerClient();
    // Provider verifies the requested token category; the URL alone grants nothing.
    const { data, error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error || !data.user || !data.session)
      return finish("/login?error=invalid_link");
    if (type === "recovery") {
      await issueRecoveryGrant(client);
      return finish("/reset-password");
    }
    // Email confirmation does not silently log a browser into a different account.
    try {
      await client.auth.signOut({ scope: "local" });
    } finally {
      await clearLocalAuthCookies();
    }
    return finish("/login?notice=email_verified");
  } catch {
    return finish("/login?error=auth_unavailable");
  }
}

export function HEAD() {
  return new NextResponse(null, {
    status: 405,
    headers: {
      Allow: "GET",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
