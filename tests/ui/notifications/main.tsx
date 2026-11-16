import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { AppHeader } from "../../../src/components/layout/header";
import "../../../src/app/globals.css";

const theme =
  new URLSearchParams(location.search).get("theme") === "dark"
    ? "dark"
    : "light";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider
      attribute="data-theme"
      forcedTheme={theme}
      enableSystem={false}
    >
      <main className="min-h-screen bg-background text-foreground">
        <p className="mb-6 rounded border border-border bg-muted px-4 py-3 text-xs">
          UJI LOKAL · DATA SINTETIS · TANPA DATABASE
        </p>
        <AppHeader
          workspace="user"
          user={{
            name: "Penguji lokal",
            email: "synthetic@example.invalid",
            emailConfirmed: true,
            roles: ["user"],
          }}
          onOpenNavigation={() => {}}
        />
      </main>
    </ThemeProvider>
  </React.StrictMode>,
);
