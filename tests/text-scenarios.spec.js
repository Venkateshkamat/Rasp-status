// @ts-check
const { test, expect } = require("@playwright/test");

const DWELL_MS = Number(process.env.TEXT_SCENARIO_DWELL_MS || 0);

async function dwell(page) {
  if (DWELL_MS > 0) await page.waitForTimeout(DWELL_MS);
}

async function mockConfig(page) {
  await page.route("**/api/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ pollIntervalMinutes: 60 * 24 }),
    })
  );
}

async function mockStatus(page, body) {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    })
  );
}

async function loadWith(page, statusBody) {
  await mockConfig(page);
  await mockStatus(page, statusBody);
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

test.describe("marquee text for each scenario", () => {
  test("LOADING... while waiting for status", async ({ page }) => {
    await mockConfig(page);
    await page.route("**/api/status", async (route) => {
      await new Promise((r) => setTimeout(r, 8_000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "pass" }),
      });
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#marquee-text")).toHaveText("LOADING...");
    await dwell(page);
  });

  test("ALL GOOD on pass", async ({ page }) => {
    await loadWith(page, { status: "pass" });
    await expect(page.locator("#marquee-text")).toHaveText("ALL GOOD");
    await dwell(page);
  });

  test("WASTED on fail", async ({ page }) => {
    await loadWith(page, { status: "fail" });
    await expect(page.locator("#marquee-text")).toHaveText("WASTED");
    await dwell(page);
  });

  test("UNKNOWN STATE when message is missing", async ({ page }) => {
    await loadWith(page, { status: "error" });
    await expect(page.locator("#marquee-text")).toHaveText("UNKNOWN STATE");
    await dwell(page);
  });

  test("UNKNOWN STATE when message is empty string", async ({ page }) => {
    await loadWith(page, { status: "error", message: "" });
    await expect(page.locator("#marquee-text")).toHaveText("UNKNOWN STATE");
    await dwell(page);
  });

  test("UNKNOWN STATE when message is null", async ({ page }) => {
    await loadWith(page, { status: "error", message: null });
    await expect(page.locator("#marquee-text")).toHaveText("UNKNOWN STATE");
    await dwell(page);
  });

  const errorMessages = [
    "NO ISSUES FOUND",
    "NO RESULT EMOJI DETECTED",
    "REPO DOES NOT EXIST",
    "GH CLI NOT LOGGED IN",
    "GH CLI NOT FOUND",
    "GH TOOK TOO LONG",
    "CORRUPTED DATA RECEIVED",
    "GH CLI BLEW UP",
    "SOMETHING WENT WRONG",
  ];

  for (const msg of errorMessages) {
    test(`error: ${msg}`, async ({ page }) => {
      await loadWith(page, { status: "error", message: msg });
      await expect(page.locator("#marquee-text")).toHaveText(msg);
      await dwell(page);
    });
  }

  test("SERVER UNREACHABLE when fetch fails", async ({ page }) => {
    await mockConfig(page);
    await page.route("**/api/status", (route) => route.abort("failed"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#marquee-text")).toHaveText("SERVER UNREACHABLE");
    await dwell(page);
  });

  test("YOU ARE OFFLINE when navigator.onLine is false", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { get: () => false });
    });
    await mockConfig(page);
    await page.route("**/api/status", (route) => route.abort("failed"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#marquee-text")).toHaveText("YOU ARE OFFLINE");
    await dwell(page);
  });
});

test.describe("demo mode (?textScenarios=1)", () => {
  test("cycles through all states", async ({ page }) => {
    await page.goto("/?textScenarios=1&dwell=3000", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#marquee-text")).toHaveText("LOADING...");
    await expect(page.locator("#marquee-text")).toHaveText("ALL GOOD", { timeout: 6000 });
    await expect(page.locator("#marquee-text")).toHaveText("WASTED", { timeout: 6000 });
    await expect(page.locator("#marquee-text")).toHaveText("SOMETHING BROKE", { timeout: 6000 });
    await dwell(page);
  });
});
