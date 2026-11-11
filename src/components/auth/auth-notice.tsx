import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthNotice({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: React.ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const Icon =
    tone === "error" ? CircleAlert : tone === "success" ? CircleCheck : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-muted px-4 py-3.5",
        tone === "error"
          ? "text-danger"
          : tone === "success"
            ? "text-success"
            : "text-muted-foreground",
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 text-sm leading-6">
        {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
