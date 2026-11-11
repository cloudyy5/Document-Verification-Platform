import type { Metadata } from "next";
import { AuthPage, type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Verifikasi email" };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return <AuthPage mode="verify-email" searchParams={searchParams} />;
}
