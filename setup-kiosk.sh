#!/usr/bin/env bash
set -euo pipefail

# Raspberry Pi kiosk mode setup for rasp-status
# Run with: sudo bash setup-kiosk.sh

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="rasp-status"
KIOSK_NAME="rasp-kiosk"
PORT=$(grep -o '"port":[[:space:]]*[0-9]*' "$APP_DIR/config.json" | grep -o '[0-9]*')
PORT=${PORT:-3000}

echo "=== rasp-status kiosk setup ==="
echo "App directory : $APP_DIR"
echo "Server port   : $PORT"
echo ""

# ── Preflight checks ────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and set GITHUB_REPO."
  exit 1
fi

# ── Install dependencies ────────────────────────────────────────
echo "[1/5] Installing system packages..."
apt-get update -qq
if apt-cache show chromium-browser &>/dev/null 2>&1; then
  apt-get install -y -qq chromium-browser unclutter xdotool
  CHROMIUM_BIN="chromium-browser"
else
  apt-get install -y -qq chromium unclutter xdotool
  CHROMIUM_BIN="chromium"
fi

echo "[2/5] Installing GitHub CLI..."
if ! command -v gh &>/dev/null; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list
  apt-get update -qq
  apt-get install -y -qq gh
fi

echo "[3/5] Installing Node.js dependencies..."
cd "$APP_DIR"
if ! command -v node &>/dev/null; then
  echo "Node.js not found. Installing via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi
npm install --production

# ── systemd service for the Node server ─────────────────────────
echo "[4/5] Creating systemd service for the status server..."
GH_PATH=$(command -v gh)
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Rasp-Status Display Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
EnvironmentFile=${APP_DIR}/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}

# ── Autostart Chromium in kiosk mode ────────────────────────────
echo "[5/5] Configuring kiosk autostart..."
AUTOSTART_DIR="/etc/xdg/lxsession/LXDE-pi"
mkdir -p "$AUTOSTART_DIR"
AUTOSTART_FILE="$AUTOSTART_DIR/autostart"

# Remove old entries if present
if [ -f "$AUTOSTART_FILE" ]; then
  sed -i "/${KIOSK_NAME}/d" "$AUTOSTART_FILE"
  sed -i "/unclutter/d" "$AUTOSTART_FILE"
  sed -i "/xset/d" "$AUTOSTART_FILE"
fi

cat >> "$AUTOSTART_FILE" <<EOF

# rasp-status kiosk mode
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5 -root
@${CHROMIUM_BIN} --noerrdialogs --disable-infobars --kiosk --disable-restore-session-state --disable-component-update http://localhost:${PORT}
EOF

echo ""
echo "=== Setup complete ==="
echo "The status server is now running. Reboot to launch kiosk mode:"
echo "  sudo reboot"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}   # check server"
echo "  sudo systemctl restart ${SERVICE_NAME}  # restart server"
echo "  journalctl -u ${SERVICE_NAME} -f        # view logs"
