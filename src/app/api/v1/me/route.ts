import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/session";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    const session = await getAuthSession();
    if (!session)
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Silakan masuk untuk melanjutkan.",
          },
        },
        { status: 401, headers },
      );
    return NextResponse.json(
      { data: { user: session.user, roles: session.roles } },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "AUTH_UNAVAILABLE",
          message: "Layanan autentikasi sementara tidak tersedia.",
        },
      },
      { status: 503, headers },
    );
  }
}
