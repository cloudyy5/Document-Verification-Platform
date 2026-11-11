"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";

export function PasswordInput({
  confirmation = false,
  ...props
}: Omit<InputProps, "type"> & { confirmation?: boolean }) {
  const [visible, setVisible] = useState(false);
  const target = confirmation ? "konfirmasi kata sandi" : "kata sandi";
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className="pr-14"
      />
      <button
        type="button"
        aria-label={`${visible ? "Sembunyikan" : "Tampilkan"} ${target}`}
        aria-pressed={visible}
        onClick={() => setVisible((previous) => !previous)}
        className="absolute right-0.5 top-7 flex size-11 items-center justify-center rounded-md text-subtle transition-colors hover:text-foreground"
      >
        <Icon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
