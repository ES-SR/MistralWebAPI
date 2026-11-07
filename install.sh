#!/bin/sh
# Setup script. Run it either way:
#
#   piped (README one-liner):
#     curl -fsSL https://raw.githubusercontent.com/ES-SR/MistralWebAPI/refs/heads/<branch>/install.sh | bash -s -- [--run]
#   from a checkout:
#     ./install.sh [--run]
#
# Piped with no ./MistralWebAPI yet: clones it. When an existing checkout is
# reused (piped or in-checkout), it first best-effort pulls (git pull --ff-only),
# then runs npm install + npm run build. --run starts the server afterwards.
# Re-running the same command is the update path.
#
# The server needs no API key; you add yours in the UI (Settings -> API -> Save).
set -eu

REPO_URL="https://github.com/ES-SR/MistralWebAPI.git"
DIR="MistralWebAPI"

RUN=0
for arg in "$@"; do
  case "$arg" in
    --run|run) RUN=1 ;;
  esac
done

FRESH_CLONE=0
if [ -f "$0" ]; then
  cd "$(dirname "$0")"
else
  if [ -d "$DIR" ]; then
    cd "$DIR"
  else
    git clone "$REPO_URL"
    cd "$DIR"
    FRESH_CLONE=1
  fi
fi

if [ "$FRESH_CLONE" = "0" ]; then
  git pull --ff-only 2>/dev/null || echo "warning: git pull failed; continuing with the current checkout" >&2
fi

npm install
npm run build

if [ "$RUN" = "1" ]; then
  exec npm start
else
  echo "Build done. Start the app with: npm start  (then open http://127.0.0.1:3000)"
fi
