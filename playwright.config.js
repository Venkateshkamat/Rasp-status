// @ts-check
const { defineConfig } = require("@playwright/test");

const PORT = process.env.PLAYWRIGHT_DISPLAY_PORT || "47831";

module.exports = defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `PLAYWRIGHT_DISPLAY_PORT=${PORT} node tests/display-static-server.cjs`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
