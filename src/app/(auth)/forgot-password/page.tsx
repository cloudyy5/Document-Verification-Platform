import type { Metadata } from "next";
import { AuthPage, type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return <AuthPage mode="forgot-password" searchParams={searchParams} />;
}
