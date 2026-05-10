(function () {
  "use strict";

  const display = document.getElementById("display");
  const track = document.getElementById("marquee-track");
  const textEl = document.getElementById("marquee-text");
  let pollMs = 60 * 60 * 1000;
  let currentState = "loading";
  let animFrame = null;

  // ── Marquee engine ───────────────────────────────────────────

  let marqueeX = 0;
  let marqueeSpeed = 0;
  let marqueeDir = -1;
  let textWidth = 0;

  function sizeText() {
    const vh = window.innerHeight;
    const fontSize = Math.floor(vh * 0.45);
    track.style.fontSize = fontSize + "px";
    track.style.lineHeight = vh + "px";
    textWidth = track.scrollWidth;
  }

  function resetMarquee() {
    sizeText();
    marqueeX = window.innerWidth;
    marqueeSpeed = Math.max(3, window.innerWidth / 200);
  }

  function tickMarquee() {
    marqueeX += marqueeDir * marqueeSpeed;
    if (marqueeX < -textWidth) {
      marqueeX = window.innerWidth;
    }
    track.style.transform = `translateX(${marqueeX}px)`;
  }

  function renderLoop() {
    tickMarquee();
    animFrame = requestAnimationFrame(renderLoop);
  }

  // ── State management ─────────────────────────────────────────

  function setState(state, message) {
    display.className = "state-" + state;
    currentState = state;

    if (state === "pass") {
      textEl.textContent = "ALL GOOD";
    } else if (state === "fail") {
      textEl.textContent = "WASTED";
    } else if (state === "error") {
      textEl.textContent = message || "SOMETHING BROKE";
    } else {
      textEl.textContent = "LOADING...";
    }

    resetMarquee();
  }

  // Steps for ?textScenarios=1 (manual QA). Keep in sync with tests/text-scenarios.spec.js
  const TEXT_SCENARIO_STEPS = [
    { state: "loading" },
    { state: "pass" },
    { state: "fail" },
    { state: "error", message: undefined },
    { state: "error", message: "NO ISSUES FOUND" },
    { state: "error", message: "NO RESULT EMOJI DETECTED" },
    { state: "error", message: "REPO DOES NOT EXIST" },
    { state: "error", message: "GH CLI NOT LOGGED IN" },
    { state: "error", message: "GH CLI NOT FOUND" },
    { state: "error", message: "GH TOOK TOO LONG" },
    { state: "error", message: "CORRUPTED DATA RECEIVED" },
    { state: "error", message: "GH CLI BLEW UP" },
    { state: "error", message: "SOMETHING WENT WRONG" },
    { state: "error", message: "UNKNOWN STATE" },
    { state: "error", message: "YOU ARE OFFLINE" },
    { state: "error", message: "SERVER UNREACHABLE" },
  ];

  function startTextScenarioDemo(dwellMs) {
    let idx = 0;
    function showStep() {
      const s = TEXT_SCENARIO_STEPS[idx];
      if (s.state === "error") setState("error", s.message);
      else setState(s.state);
    }
    showStep();
    setInterval(() => {
      idx = (idx + 1) % TEXT_SCENARIO_STEPS.length;
      showStep();
    }, dwellMs);
  }

  // ── Polling ──────────────────────────────────────────────────

  async function fetchStatus() {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("FETCH FAILED: " + res.status);
      const data = await res.json();

      if (data.status === "pass") setState("pass");
      else if (data.status === "fail") setState("fail");
      else setState("error", data.message || "UNKNOWN STATE");
    } catch (err) {
      const msg = navigator.onLine === false ? "YOU ARE OFFLINE" : "SERVER UNREACHABLE";
      setState("error", msg);
    }
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("textScenarios") === "1") {
      const dwell = Math.max(2000, Number(params.get("dwell")) || 12000);
      setState("loading");
      renderLoop();
      startTextScenarioDemo(dwell);
      return;
    }

    setState("loading");
    renderLoop();

    try {
      const cfgRes = await fetch("/api/config");
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        pollMs = (cfg.pollIntervalMinutes || 60) * 60 * 1000;
      }
    } catch (_) { /* use default */ }

    await fetchStatus();
    setInterval(fetchStatus, pollMs);
  }

  window.addEventListener("resize", () => {
    sizeText();
  });

  init();
})();
