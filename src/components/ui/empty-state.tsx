import { FileText, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  icon: Icon = FileText,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-14 text-center sm:py-20">
      <div className="mb-5 flex size-14 items-center justify-center rounded-xl border border-border bg-muted text-subtle">
        <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {children && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
