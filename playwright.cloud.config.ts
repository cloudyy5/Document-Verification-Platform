import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const enabled =
  process.env.DVP_CLOUD_CONFIRM === "persistent-development-fixture";
// The browser process needs system settings, never app/test credentials.
const browserEnvironment: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (
    typeof value === "string" &&
    !/secret|password|token|cookie|key|database_url/i.test(key) &&
    !key.startsWith("DVP_")
  )
    browserEnvironment[key] = value;
}

export default defineConfig({
  ...base,
  testDir: "./tests/cloud",
  outputDir: "./test-results/cloud-acceptance",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...base.use,
    // Full Chromium supports the native PDF viewer; headless-shell does not.
    channel: "chromium",
    trace: "off",
    screenshot: "off",
    launchOptions: { env: browserEnvironment },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: enabled ? base.webServer : undefined,
});
