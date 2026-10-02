import { defineConfig, devices } from "@playwright/test";

// Browser E2E of the demo flows. Mutates demo data → run `npm run db:seed` before (and after).
// Target: local dev server by default, or a deployed URL via E2E_BASE_URL.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
