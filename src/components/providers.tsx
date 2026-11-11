"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { NotificationProvider } from "@/components/ui/notification";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      storageKey="dvp-theme"
      disableTransitionOnChange
    >
      <NotificationProvider>{children}</NotificationProvider>
    </ThemeProvider>
  );
}
