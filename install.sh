#!/bin/sh
# Basic setup script: installs dependencies and builds the client.
# Usage:
#   ./install.sh             -> npm install + npm run build
#   ./install.sh --run       -> also start the server (npm start)
#   ./install.sh --update    -> git pull --ff-only first, then install + build
#   ./install.sh --update --run
# The server needs no API key; you add yours in the UI (Settings -> API -> Save).
set -eu
cd "$(dirname "$0")"

RUN=0
UPDATE=0
for arg in "$@"; do
  case "$arg" in
    --run|run) RUN=1 ;;
    --update|update) UPDATE=1 ;;
  esac
done

if [ "$UPDATE" = "1" ]; then
  git pull --ff-only || echo "warning: git pull failed; continuing with the current checkout" >&2
fi

npm install
npm run build

if [ "$RUN" = "1" ]; then
  exec npm start
else
  echo "Build done. Start the app with: npm start  (then open http://127.0.0.1:3000)"
fi
