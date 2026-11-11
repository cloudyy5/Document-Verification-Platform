import { defineConfig } from "@playwright/test";
const env: Record<string, string> = {};
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
  if (process.env[key]) env[key] = process.env[key]!;
export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "qr-editor.spec.ts",
  outputDir: "test-results/qr-editor-browser",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3201",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { env },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1400, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-qr-editor.mjs",
    url: "http://127.0.0.1:3201",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
