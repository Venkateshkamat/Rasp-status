/**
 * Serves public/ for Playwright. No .env or gh — the browser app is tested with mocked APIs.
 */
const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));

const PORT = Number(process.env.PLAYWRIGHT_DISPLAY_PORT || 47831);

if (require.main === module) {
  app.listen(PORT, "127.0.0.1", () => {
    process.stdout.write(`display-static-server http://127.0.0.1:${PORT}\n`);
  });
}

module.exports = { app, PORT };
