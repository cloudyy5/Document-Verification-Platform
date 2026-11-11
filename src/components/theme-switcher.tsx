"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { SunMoon } from "lucide-react";

const subscribe = () => () => {};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-muted-foreground">
      <SunMoon className="size-4 shrink-0" aria-hidden="true" />
      <select
        aria-label="Tema"
        value={mounted ? (theme ?? "system") : "system"}
        onChange={(event) => setTheme(event.target.value)}
        disabled={!mounted}
        className="min-h-11 min-w-16 cursor-pointer bg-transparent pr-1 text-xs font-medium text-foreground disabled:cursor-wait"
      >
        <option value="light">Terang</option>
        <option value="dark">Gelap</option>
        <option value="system">Sistem</option>
      </select>
    </div>
  );
}
