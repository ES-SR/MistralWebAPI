#!/bin/sh
# Basic setup script: installs dependencies and builds the client.
# Usage:
#   ./install.sh          -> npm install + npm run build
#   ./install.sh --run    -> also start the server (npm start)
# The server needs no API key; you add yours in the UI (Settings -> API).
set -eu
cd "$(dirname "$0")"

npm install
npm run build

if [ "${1:-}" = "--run" ] || [ "${1:-}" = "run" ]; then
  exec npm start
else
  echo "Build done. Start the app with: npm start  (then open http://127.0.0.1:3000)"
fi
