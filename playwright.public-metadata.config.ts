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
  testMatch: "public-metadata.spec.ts",
  outputDir: "test-results/public-metadata-browser",
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3205",
    browserName: "chromium",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: { env: browserEnvironment },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "node scripts/serve-public-metadata-ui.mjs",
    url: "http://127.0.0.1:3205",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
