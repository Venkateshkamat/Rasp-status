#!/usr/bin/env bash
set -euo pipefail

# Raspberry Pi kiosk mode setup for rasp-status
# Run with: sudo bash setup-kiosk.sh

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_NAME="rasp-status"
KIOSK_NAME="rasp-kiosk"
PORT=$(grep -o '"port":[[:space:]]*[0-9]*' "$APP_DIR/config.json" | grep -o '[0-9]*')
PORT=${PORT:-3000}
REAL_USER="${SUDO_USER:-$(logname 2>/dev/null || echo pi)}"
REAL_HOME=$(eval echo "~${REAL_USER}")

echo "=== rasp-status kiosk setup ==="
echo "App directory : $APP_DIR"
echo "Server port   : $PORT"
echo "Running user  : $REAL_USER"
echo ""

# ── Preflight checks ────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and set GITHUB_REPO."
  exit 1
fi

# ── Install dependencies ────────────────────────────────────────
echo "[1/5] Installing system packages..."
apt-get update -qq
if apt-get install -y -qq chromium-browser 2>/dev/null; then
  CHROMIUM_BIN="chromium-browser"
else
  apt-get install -y -qq chromium
  CHROMIUM_BIN="chromium"
fi
apt-get install -y -qq unclutter

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
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Rasp-Status Display Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${REAL_USER}
Group=${REAL_USER}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node ${APP_DIR}/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=HOME=${REAL_HOME}
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

# XDG autostart .desktop file (works with labwc/wayfire/LXDE)
mkdir -p /etc/xdg/autostart
cat > /etc/xdg/autostart/${KIOSK_NAME}.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Rasp Status Kiosk
Comment=Launch Chromium in kiosk mode for rasp-status
Exec=/bin/sh -c 'sleep 5 && ${CHROMIUM_BIN} --noerrdialogs --disable-infobars --kiosk --disable-restore-session-state --disable-component-update --ozone-platform=wayland http://localhost:${PORT}'
X-GNOME-Autostart-enabled=true
EOF

cat > /etc/xdg/autostart/${KIOSK_NAME}-cursor.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Hide Cursor
Exec=unclutter -idle 0.5 -root
X-GNOME-Autostart-enabled=true
EOF

echo ""
echo "=== Setup complete ==="
echo "The status server is running as user '${REAL_USER}'."
echo "Reboot to launch kiosk mode:"
echo "  sudo reboot"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status ${SERVICE_NAME}   # check server"
echo "  sudo systemctl restart ${SERVICE_NAME}  # restart server"
echo "  journalctl -u ${SERVICE_NAME} -f        # view logs"
