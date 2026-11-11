import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorState({
  title = "Data belum dapat ditampilkan",
  description,
  children,
}: {
  title?: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center px-5 py-12 text-center"
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-danger-soft text-danger">
        <AlertCircle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
