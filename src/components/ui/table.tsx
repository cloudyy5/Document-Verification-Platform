import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({
  className,
  children,
  ...props
}: React.ComponentProps<"table">) {
  return (
    <div
      className="max-w-full overflow-x-auto rounded-lg border border-border"
      role="region"
      aria-label="Tabel data"
      tabIndex={0}
    >
      <table
        className={cn("w-full border-collapse text-left text-sm", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<"thead">) {
  return (
    <thead
      className={cn("bg-muted text-muted-foreground", className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("divide-y divide-border bg-surface", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("border-b border-border last:border-b-0", className)}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 whitespace-nowrap px-5 py-3 text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "h-16 px-5 py-4 align-middle text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      className={cn(
        "caption-bottom border-t border-border bg-surface px-5 py-3 text-left text-xs text-subtle",
        className,
      )}
      {...props}
    />
  );
}
