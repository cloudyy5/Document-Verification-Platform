"use client";

import { useActionState, useState } from "react";
import { Check, Mail, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { updateProfileAction } from "@/app/(user)/profile/actions";
import { AuthNotice } from "@/components/auth/auth-notice";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { OwnCodeCard } from "@/features/signing/own-code-card";
import { formatDate } from "./format";
import type { ProfileActionState, ProfileDTO } from "./types";

const initialState: ProfileActionState = { status: "idle" };

export function WorkspaceProfile({
  profile,
  workspace = "user",
}: {
  profile: ProfileDTO;
  workspace?: "user" | "admin";
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    initialState,
  );
  const [fullName, setFullName] = useState(profile.fullName ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={workspace === "admin" ? "Admin workspace" : "User workspace"}
        title="Profil & preferensi"
        description="Kelola informasi profil, keamanan akun, dan tampilan workspace."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel" aria-labelledby="profile-information">
          <div className="flex items-center gap-3 border-b border-border px-5 py-5">
            <span className="rounded-lg bg-muted p-3 text-subtle">
              <UserRound size={22} aria-hidden="true" />
            </span>
            <div>
              <h2 id="profile-information" className="section-heading">
                Informasi profil
              </h2>
              <p className="mt-1 text-xs text-subtle">
                Terdaftar {formatDate(profile.createdAt)}
              </p>
            </div>
          </div>
          <form
            action={action}
            aria-busy={pending}
            className="space-y-5 p-5 sm:p-6"
          >
            {state.message && (
              <AuthNotice
                tone={
                  state.status === "error"
                    ? "error"
                    : state.status === "success"
                      ? "success"
                      : "info"
                }
                title={
                  state.status === "error"
                    ? "Perubahan belum tersimpan"
                    : "Informasi profil"
                }
              >
                {state.message}
              </AuthNotice>
            )}
            <Input
              label="Nama lengkap"
              name="fullName"
              autoComplete="name"
              maxLength={120}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={pending}
              error={state.fieldErrors?.fullName}
            />
            <Input
              label="Nomor telepon (opsional)"
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={pending}
              error={state.fieldErrors?.phone}
              hint="Kosongkan jika tidak ingin menyimpan nomor telepon."
            />
            <div className="border-t border-border pt-5">
              <Input
                label="Email"
                value={profile.email}
                readOnly
                autoComplete="email"
                hint="Perubahan alamat email belum tersedia."
              />
              <div className="mt-3">
                {profile.emailConfirmed ? (
                  <Badge tone="success">
                    <Check size={13} aria-hidden="true" /> Email terverifikasi
                  </Badge>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warning">
                      <Mail size={13} aria-hidden="true" /> Email belum
                      terverifikasi
                    </Badge>
                    <Link
                      href="/verify-email"
                      className="inline-flex min-h-11 items-center text-xs font-medium text-primary"
                    >
                      Verifikasi email
                    </Link>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
              <Button
                type="submit"
                disabled={pending}
                className="w-full sm:w-auto"
              >
                <Save aria-hidden="true" />
                {pending ? "Menyimpan…" : "Simpan perubahan"}
              </Button>
            </div>
          </form>
        </section>
        <aside className="space-y-5">
          {workspace === "user" && <OwnCodeCard />}
          <section className="panel p-5" aria-labelledby="account-security">
            <h2 id="account-security" className="section-heading">
              Keamanan akun
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Gunakan alur pemulihan melalui email untuk mengganti kata sandi
              Anda secara aman.
            </p>
            <Button asChild variant="secondary" className="mt-4 w-full">
              <Link href="/forgot-password">Pulihkan kata sandi</Link>
            </Button>
          </section>
          <section
            className="panel p-5"
            aria-labelledby="appearance-preferences"
          >
            <h2 id="appearance-preferences" className="section-heading">
              Tampilan
            </h2>
            <p className="mb-4 mt-3 text-sm leading-6 text-muted-foreground">
              Pilih tema terang, gelap, atau ikuti pengaturan perangkat. Pilihan
              tersimpan di browser ini.
            </p>
            <ThemeSwitcher />
          </section>
          <section className="px-1">
            <h2 className="font-medium">Notifikasi</h2>
            <p className="mt-2 text-xs leading-6 text-subtle">
              Pengaturan preferensi notifikasi belum tersedia.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
