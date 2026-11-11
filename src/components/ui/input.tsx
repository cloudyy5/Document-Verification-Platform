"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      id,
      className,
      containerClassName,
      "aria-describedby": describedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const descriptions =
      [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className={cn("space-y-2", containerClassName)}>
        <label
          htmlFor={inputId}
          className="block text-[13px] font-medium text-foreground"
        >
          {label}
          {props.required && (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>
        <input
          {...props}
          id={inputId}
          ref={ref}
          aria-invalid={error ? true : props["aria-invalid"]}
          aria-describedby={descriptions}
          className={cn(
            "min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle transition-colors disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 read-only:bg-muted",
            error && "border-danger",
            className,
          )}
        />
        {hint && (
          <p id={hintId} className="text-xs leading-5 text-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p
            id={errorId}
            className="text-xs leading-5 text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
