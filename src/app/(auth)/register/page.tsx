import type { Metadata } from "next";
import { AuthPage, type AuthSearchParams } from "@/components/auth/auth-page";

export const metadata: Metadata = { title: "Buat akun" };

export default function RegisterPage({
  searchParams,
}: {
  searchParams: AuthSearchParams;
}) {
  return <AuthPage mode="register" searchParams={searchParams} />;
}
