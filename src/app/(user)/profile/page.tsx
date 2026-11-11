import type { Metadata } from "next";
import { WorkspaceProfile } from "@/features/workspace/profile-form";
import { requireAuthenticated } from "@/lib/auth/session";
import { getWorkspaceProfile } from "@/server/workspace/queries";
import { isAdminAccount } from "@/lib/auth/workspace";

export const metadata: Metadata = { title: "Profil & preferensi" };

export default async function ProfilePage() {
  const session = await requireAuthenticated("/profile");
  const profile = await getWorkspaceProfile();
  return (
    <WorkspaceProfile
      profile={profile}
      workspace={isAdminAccount(session.roles) ? "admin" : "user"}
    />
  );
}
