import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnv } from "@/lib/env/public";
import { sanitizeReturnTo } from "@/lib/auth/redirects";
import type { Database } from "@/types/database";

function privateResponse(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  const vary =
    response.headers
      .get("Vary")
      ?.split(",")
      .map((value) => value.trim()) ?? [];
  if (!vary.some((value) => value.toLowerCase() === "cookie"))
    vary.push("Cookie");
  response.headers.set("Vary", vary.join(", "));
  return response;
}

function isPrivatePath(pathname: string) {
  return (
    /^\/(dashboard|documents|submit|verify|profile|admin|signing|requests|receipts)(?:\/|$)/.test(
      pathname,
    ) || /^\/api\/v[12](?:\/|$)/.test(pathname)
  );
}

/** Refresh both request and response cookies; pages/DAL still verify identity and roles. */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isPrivatePath(pathname);
  let response = privateResponse(NextResponse.next({ request }));

  function deny(serviceUnavailable = false) {
    let denied: NextResponse;
    if (/^\/api\/v[12](?:\/|$)/.test(pathname)) {
      denied = NextResponse.json(
        {
          error: {
            code: serviceUnavailable ? "AUTH_UNAVAILABLE" : "UNAUTHENTICATED",
            message: serviceUnavailable
              ? "Layanan autentikasi sementara tidak tersedia."
              : "Silakan masuk untuk melanjutkan.",
          },
        },
        { status: serviceUnavailable ? 503 : 401 },
      );
    } else {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      target.search = "";
      target.searchParams.set(
        "next",
        sanitizeReturnTo(`${pathname}${request.nextUrl.search}`),
      );
      if (serviceUnavailable)
        target.searchParams.set("error", "auth_unavailable");
      denied = NextResponse.redirect(target);
    }
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    for (const name of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(name);
      if (value) denied.headers.set(name, value);
    }
    return privateResponse(denied);
  }

  let environment;
  try {
    environment = getPublicEnv();
  } catch {
    return protectedRoute ? deny() : response;
  }

  try {
    const supabase = createServerClient<Database>(
      environment.supabaseUrl,
      environment.supabasePublishableKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet, headers) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            const previous = response.cookies.getAll();
            response = privateResponse(NextResponse.next({ request }));
            previous.forEach((cookie) => response.cookies.set(cookie));
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
            Object.entries(headers).forEach(([name, value]) =>
              response.headers.set(name, value),
            );
          },
        },
      },
    );

    const { data, error } = await supabase.auth.getUser();
    if (protectedRoute && (error || !data.user)) {
      const unavailable =
        error?.name === "AuthRetryableFetchError" ||
        error?.status === 0 ||
        (error?.status ?? 0) >= 500;
      return deny(unavailable);
    }
    return privateResponse(response);
  } catch {
    return protectedRoute ? deny(true) : response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/documents/:path*",
    "/submit/:path*",
    "/verify/:path*",
    "/profile/:path*",
    "/admin/:path*",
    "/signing/:path*",
    "/requests/:path*",
    "/receipts/:path*",
    "/api/v1/:path*",
    "/api/v2/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/auth/:path*",
  ],
};
