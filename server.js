const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

// ── Load .env manually (no extra dependency) ───────────────────
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const GITHUB_REPO = process.env.GITHUB_REPO;
if (!GITHUB_REPO) {
  console.error("[rasp-status] GITHUB_REPO is not set. Add it to .env or export it.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
const PORT = config.port || 3000;

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// ── gh CLI wrapper ─────────────────────────────────────────────

function ghFetchLatestIssue() {
  return new Promise((resolve, reject) => {
    const args = [
      "issue", "list",
      "--repo", GITHUB_REPO,
      "--state", "all",
      "--limit", "1",
      "--json", "title,body",
    ];

    execFile("gh", args, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || "").toLowerCase();
        if (msg.includes("not found") || msg.includes("404"))        return reject(new Error("REPO_NOT_FOUND"));
        if (msg.includes("auth") || msg.includes("login"))           return reject(new Error("GH_NOT_AUTHED"));
        if (msg.includes("not installed") || err.code === "ENOENT")  return reject(new Error("GH_NOT_INSTALLED"));
        if (err.killed || msg.includes("timed out"))                 return reject(new Error("GH_TIMEOUT"));
        return reject(new Error("GH_ERROR"));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("BAD_JSON"));
      }
    });
  });
}

// ── Status endpoint ────────────────────────────────────────────

app.get("/api/status", async (_req, res) => {
  try {
    const issues = await ghFetchLatestIssue();

    if (!Array.isArray(issues) || issues.length === 0) {
      return res.json({ status: "error", message: "NO ISSUES FOUND" });
    }

    const latest = issues[0];
    const combined = (latest.title || "") + " " + (latest.body || "");

    if (combined.includes(config.passEmoji)) return res.json({ status: "pass" });
    if (combined.includes(config.failEmoji)) return res.json({ status: "fail" });

    return res.json({ status: "error", message: "NO RESULT EMOJI DETECTED" });
  } catch (err) {
    const tag = err.message || "UNKNOWN";
    const messages = {
      REPO_NOT_FOUND:   "REPO DOES NOT EXIST",
      GH_NOT_AUTHED:    "GH CLI NOT LOGGED IN",
      GH_NOT_INSTALLED: "GH CLI NOT FOUND",
      GH_TIMEOUT:       "GH TOOK TOO LONG",
      BAD_JSON:         "CORRUPTED DATA RECEIVED",
      GH_ERROR:         "GH CLI BLEW UP",
    };
    return res.json({ status: "error", message: messages[tag] || "SOMETHING WENT WRONG" });
  }
});

app.get("/api/config", (_req, res) => {
  res.json({ pollIntervalMinutes: config.pollIntervalMinutes });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[rasp-status] Display server running at http://0.0.0.0:${PORT}`);
  console.log(`[rasp-status] Monitoring ${GITHUB_REPO} every ${config.pollIntervalMinutes} min`);
});
