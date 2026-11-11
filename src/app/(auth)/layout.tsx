import { AuthLayout } from "@/components/auth/auth-layout";

export default function AuthenticationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayout>{children}</AuthLayout>;
}
