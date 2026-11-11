import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const enabled = process.env.DVP_SIGNING_R3_CLOUD_TEST === "1";
// Browser processes need OS settings, never application/test credentials.
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
  testMatch: "**/signing-r3-cloud.spec.ts",
  testIgnore: [],
  outputDir: "./test-results/signing-r3-cloud-browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:3100",
    channel: "chromium",
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: { env: browserEnvironment },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: enabled
    ? {
        command: "npm run start -- --port 3100",
        env: { APP_URL: "http://127.0.0.1:3100" },
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
