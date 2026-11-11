import type { Metadata } from "next";
import { AuthPage, type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Kata sandi baru" };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return <AuthPage mode="reset-password" searchParams={searchParams} />;
}
