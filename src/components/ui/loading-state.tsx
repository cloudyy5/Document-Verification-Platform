import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Memuat data…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex min-h-36 items-center justify-center gap-3 px-5 py-10 text-sm text-subtle"
    >
      <LoaderCircle
        className="size-5 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
