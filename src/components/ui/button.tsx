import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "default" | "sm" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border-border bg-surface text-foreground hover:bg-muted",
  ghost:
    "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive: "border-transparent bg-danger text-surface hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  default: "min-h-11 gap-2 px-4 py-2.5 text-sm",
  sm: "min-h-11 gap-1.5 px-3 py-2 text-xs sm:min-h-8",
  icon: "size-11 shrink-0 p-2.5",
};

export function buttonVariants({
  variant = "primary",
  size = "default",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center rounded-md border font-semibold leading-5 transition-colors disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Component = asChild ? Slot : "button";
    return (
      <Component
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        {...(!asChild ? { type: type ?? "button" } : {})}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
