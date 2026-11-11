"use client";

import { WorkspaceError } from "@/features/workspace/workspace-states";

export default function Error({ retry }: { retry: () => void }) {
  return <WorkspaceError reset={retry} />;
}
