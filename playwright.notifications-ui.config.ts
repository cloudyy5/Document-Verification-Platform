import { defineConfig } from "@playwright/test";
const browserEnvironment: Record<string, string> = {};
for (const key of [
  "PATH",
  "SystemRoot",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "PATHEXT",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
])
  if (process.env[key]) browserEnvironment[key] = process.env[key]!;
export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "notifications.spec.ts",
  outputDir: "./test-results/notifications-browser",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3203",
    browserName: "chromium",
    launchOptions: { env: browserEnvironment },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "node scripts/serve-notifications-ui.mjs",
    url: "http://127.0.0.1:3203",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
