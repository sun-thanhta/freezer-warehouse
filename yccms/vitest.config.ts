import { defineConfig } from "vitest/config";

// Unit tests live next to the code in src/; e2e/ is Playwright's (npm run test:e2e); SQL tests are pgTAP (npm run db:test).
export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
