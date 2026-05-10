(function () {
  "use strict";

  const display = document.getElementById("display");
  const track = document.getElementById("marquee-track");
  const textEl = document.getElementById("marquee-text");
  const canvas = document.getElementById("fx-canvas");
  const ctx = canvas.getContext("2d");

  let pollMs = 60 * 60 * 1000;
  let currentState = "loading";
  let animFrame = null;
  let particles = [];

  // ── Particle FX ──────────────────────────────────────────────

  class Particle {
    constructor(x, y, color, type) {
      this.x = x;
      this.y = y;
      this.color = color;
      this.type = type;
      this.life = 1;

      if (type === "spark") {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.decay = 0.008 + Math.random() * 0.015;
        this.size = 2 + Math.random() * 3;
      } else if (type === "confetti") {
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = -3 - Math.random() * 5;
        this.gravity = 0.12;
        this.decay = 0.004 + Math.random() * 0.006;
        this.size = 3 + Math.random() * 5;
        this.rotation = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.2;
      } else if (type === "skull") {
        this.vy = -0.5 - Math.random() * 1.5;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.decay = 0.005 + Math.random() * 0.005;
        this.size = 16 + Math.random() * 20;
      } else if (type === "glitch") {
        this.width = 30 + Math.random() * 200;
        this.height = 2 + Math.random() * 6;
        this.decay = 0.03 + Math.random() * 0.05;
      }
    }

    update() {
      this.life -= this.decay;
      if (this.type === "spark") {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.99;
        this.vy *= 0.99;
      } else if (this.type === "confetti") {
        this.x += this.vx;
        this.vy += this.gravity;
        this.y += this.vy;
        this.rotation += this.spin;
      } else if (this.type === "skull") {
        this.x += this.vx;
        this.y += this.vy;
      } else if (this.type === "glitch") {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
      }
      return this.life > 0;
    }

    draw(ctx) {
      ctx.globalAlpha = Math.max(0, this.life);
      if (this.type === "spark") {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
      } else if (this.type === "confetti") {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
        ctx.restore();
      } else if (this.type === "skull") {
        ctx.font = `${this.size}px serif`;
        ctx.fillText("💀", this.x, this.y);
      } else if (this.type === "glitch") {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
      }
      ctx.globalAlpha = 1;
    }
  }

  function spawnPassFX() {
    const colors = ["#00ff41", "#39ff14", "#7fff00", "#00e676", "#69f0ae", "#ffffff"];
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      particles.push(new Particle(x, y, colors[Math.floor(Math.random() * colors.length)], "confetti"));
    }
  }

  function spawnFailFX() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    for (let i = 0; i < 40; i++) {
      particles.push(new Particle(cx, cy, "#ff1744", "spark"));
    }
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * canvas.width;
      particles.push(new Particle(x, canvas.height, null, "skull"));
    }
  }

  function spawnErrorFX() {
    for (let i = 0; i < 15; i++) {
      const color = Math.random() > 0.5 ? "rgba(255,171,0,0.3)" : "rgba(255,255,255,0.15)";
      particles.push(new Particle(0, 0, color, "glitch"));
    }
  }

  // ── Marquee engine ───────────────────────────────────────────

  let marqueeX = 0;
  let marqueeSpeed = 0;
  let marqueeDir = -1;
  let textWidth = 0;
  let fxInterval = null;

  function sizeText() {
    const vh = window.innerHeight;
    const fontSize = Math.floor(vh * 0.65);
    track.style.fontSize = fontSize + "px";
    track.style.lineHeight = vh + "px";
    textWidth = track.scrollWidth;
  }

  function resetMarquee() {
    sizeText();
    marqueeX = window.innerWidth;
    marqueeSpeed = Math.max(1.5, window.innerWidth / 400);
  }

  function tickMarquee() {
    marqueeX += marqueeDir * marqueeSpeed;
    if (marqueeX < -textWidth) {
      marqueeX = window.innerWidth;
    }
    track.style.transform = `translateX(${marqueeX}px)`;
  }

  // ── Canvas loop ──────────────────────────────────────────────

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function renderLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => {
      const alive = p.update();
      if (alive) p.draw(ctx);
      return alive;
    });
    tickMarquee();
    animFrame = requestAnimationFrame(renderLoop);
  }

  // ── State management ─────────────────────────────────────────

  function setState(state, message) {
    if (fxInterval) {
      clearInterval(fxInterval);
      fxInterval = null;
    }
    particles = [];

    display.className = "state-" + state;
    currentState = state;

    if (state === "pass") {
      textEl.textContent = "ALL TESTS PASSED!";
      spawnPassFX();
      fxInterval = setInterval(spawnPassFX, 3000);
    } else if (state === "fail") {
      textEl.textContent = "WASTED";
      spawnFailFX();
      fxInterval = setInterval(spawnFailFX, 4000);
    } else if (state === "error") {
      textEl.textContent = message || "SOMETHING BROKE";
      spawnErrorFX();
      fxInterval = setInterval(spawnErrorFX, 2000);
    } else {
      textEl.textContent = "LOADING...";
    }

    resetMarquee();
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
    resizeCanvas();
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
    resizeCanvas();
    sizeText();
  });

  init();
})();
