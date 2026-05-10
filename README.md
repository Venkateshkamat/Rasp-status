# Rasp-Status

Fullscreen test-status display for Raspberry Pi. Uses the **GitHub CLI (`gh`)** to poll the latest issue from a repo, checks for a pass/fail emoji, and renders the result as scrolling marquee text with a retro pixel font and particle effects.

```
 ████  PASS  → "ALL TESTS PASSED!" in green with confetti
 ████  FAIL  → "WASTED" in red with sparks and skulls
 ████  ERROR → descriptive message in amber with glitch bars
```

## How It Works

1. A lightweight Node.js server shells out to `gh issue list` to fetch the **latest issue** from the configured GitHub repo.
2. It scans the issue title and body for a ✅ (pass) or ❌ (fail) emoji.
3. A fullscreen browser page renders the result as a horizontally scrolling marquee that fills the entire screen height.
4. The display auto-refreshes on a configurable interval (default: 60 minutes).

Using `gh` CLI means authentication is handled by `gh auth login` — private repos work out of the box and there are no API rate-limit concerns.

## Prerequisites

- **Node.js** >= 18
- **GitHub CLI** (`gh`) — [install guide](https://cli.github.com/)
- Authenticated via `gh auth login`

## Quick Start

```bash
# Clone the repo
git clone https://github.com/YOUR_USER/Rasp-status.git
cd Rasp-status

# Set the target repo
cp .env.example .env
# Edit .env and set GITHUB_REPO=owner/repo-name

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000` in any browser to see the display.

## Raspberry Pi Kiosk Setup

For a dedicated always-on display, run the setup script on your Pi:

```bash
# First, set up the target repo
cp .env.example .env
nano .env   # set GITHUB_REPO=owner/repo-name

# Authenticate gh (do this as the pi user, not root)
gh auth login

# Run the kiosk setup
sudo bash setup-kiosk.sh
sudo reboot
```

The setup script will:
- Install Chromium, unclutter, GitHub CLI, and Node.js if needed
- Run `npm install`
- Create a systemd service (`rasp-status`) that reads from `.env`
- Configure Chromium to launch in kiosk mode on boot
- Disable screen blanking and power management

### Managing the Service

```bash
sudo systemctl status rasp-status    # check status
sudo systemctl restart rasp-status   # restart after config changes
sudo systemctl stop rasp-status      # stop the server
journalctl -u rasp-status -f         # tail logs
```

## Configuration

### `.env` — Repository Target

```
GITHUB_REPO=Quasistatics/IC-testbench-Integration-test
```

This is the only setting that contains sensitive/environment-specific data and is git-ignored. Change it to point at any `owner/repo`.

### `config.json` — Display Settings

```json
{
  "pollIntervalMinutes": 60,
  "port": 3000,
  "passEmoji": "✅",
  "failEmoji": "❌"
}
```

| Key | Description | Default |
|-----|-------------|---------|
| `pollIntervalMinutes` | How often to fetch results (minutes) | `60` |
| `port` | Local server port | `3000` |
| `passEmoji` | Emoji that indicates a passing result | `✅` |
| `failEmoji` | Emoji that indicates a failing result | `❌` |

After editing either file, restart the service:

```bash
sudo systemctl restart rasp-status
```

## Customization

### Changing Display Text

In `public/app.js`, find the `setState` function:

```js
if (state === "pass") {
  textEl.textContent = "ALL TESTS PASSED!";
} else if (state === "fail") {
  textEl.textContent = "WASTED";
}
```

Change the strings to whatever you want displayed.

### Changing Colors

Edit the color classes in `public/style.css`:

```css
.state-pass #marquee-track  { color: #00ff41; }  /* green */
.state-fail #marquee-track  { color: #ff1744; }  /* red */
.state-error #marquee-track { color: #ffab00; }  /* amber */
```

The `text-shadow` on `#marquee-track` creates the glow — it uses `currentColor` so it follows automatically.

### Changing Font Size

The marquee text auto-sizes to 65% of the viewport height. Adjust in `public/app.js` inside `sizeText()`:

```js
const fontSize = Math.floor(vh * 0.65);  // change 0.65 to scale up or down
```

### Changing Scroll Speed

In `public/app.js` inside `resetMarquee()`:

```js
marqueeSpeed = Math.max(1.5, window.innerWidth / 400);  // adjust divisor
```

A smaller divisor = faster scroll. A larger divisor = slower scroll.

### Adding Custom Error Messages

Server-side error messages are defined in `server.js`:

```js
const messages = {
  REPO_NOT_FOUND:   "REPO DOES NOT EXIST",
  GH_NOT_AUTHED:    "GH CLI NOT LOGGED IN",
  GH_NOT_INSTALLED: "GH CLI NOT FOUND",
  GH_TIMEOUT:       "GH TOOK TOO LONG",
  BAD_JSON:         "CORRUPTED DATA RECEIVED",
  GH_ERROR:         "GH CLI BLEW UP",
};
```

Add or modify entries to customize what appears on screen for each error type.

## Project Structure

```
Rasp-status/
├── .env                 # GITHUB_REPO (git-ignored)
├── .env.example         # template for .env
├── config.json          # display and polling settings
├── server.js            # Express server + gh CLI runner
├── package.json
├── setup-kiosk.sh       # Raspberry Pi kiosk auto-setup
├── public/
│   ├── index.html       # page shell
│   ├── style.css        # layout, colors, scanlines
│   └── app.js           # marquee engine, particles, polling
└── README.md
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Blank screen after boot | Check `journalctl -u rasp-status -f` for server errors |
| "GH CLI NOT LOGGED IN" | Run `gh auth login` as the user the service runs under |
| "GH CLI NOT FOUND" | Install the GitHub CLI: `sudo apt install gh` |
| "REPO DOES NOT EXIST" | Check `GITHUB_REPO` in `.env` — must be `owner/repo` format |
| "SERVER UNREACHABLE" | The Node server isn't running — `sudo systemctl restart rasp-status` |
| "YOU ARE OFFLINE" | Pi has no network connection |
| Font not loading | Ensure the Pi has internet access for Google Fonts on first load |
| Screen goes blank | Run `xset s off && xset -dpms` or re-run `setup-kiosk.sh` |

## License

MIT
