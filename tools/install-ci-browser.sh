#!/usr/bin/env bash
set -euo pipefail

# The hosted runner's Azure HTTP mirror timed out before any browser test ran.
# Keep Playwright's complete dependency installation, using Ubuntu's HTTPS archive.
if [[ -f /etc/apt/apt-mirrors.txt ]]; then
  sudo sed -i -E 's#https?://azure\.archive\.ubuntu\.com/ubuntu#https://archive.ubuntu.com/ubuntu#g' /etc/apt/apt-mirrors.txt
fi
npx playwright install --with-deps chromium
