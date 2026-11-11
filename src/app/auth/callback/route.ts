import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthConfiguration } from "@/lib/auth/config";
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
  const target = new URL(path, origin);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code || !/^[A-Za-z0-9_-]{16,2048}$/.test(code))
    return finish("/login?error=invalid_callback");
  try {
    getAuthConfiguration();
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session || !data.user)
      return finish("/login?error=invalid_callback");
    // SDK redirectType is stored in browser storage, so it is not recovery proof.
    if ("redirectType" in data && data.redirectType === "recovery") {
      try {
        await client.auth.signOut({ scope: "local" });
      } finally {
        await clearLocalAuthCookies();
      }
      return finish("/forgot-password?error=recovery_required");
    }
    // Phase 2 uses this endpoint only for email confirmation, not OAuth sign-in.
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
