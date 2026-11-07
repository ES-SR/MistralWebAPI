#!/bin/sh
# Setup script. Two ways to run:
#
#   1. From a checkout:        ./install.sh [--update] [--run]
#   2. Piped from the raw URL: curl -fsSL <raw-url>/install.sh | bash -s -- [--update] [--run]
#      (clones into ./MistralWebAPI if missing, then installs + builds)
#
# Flags:
#   --update   git pull --ff-only before building (best-effort)
#   --run      start the server after building (npm start)
#
# The server needs no API key; you add yours in the UI (Settings -> API -> Save).
set -eu

REPO_URL="https://github.com/ES-SR/MistralWebAPI.git"
DIR="MistralWebAPI"

RUN=0
UPDATE=0
for arg in "$@"; do
  case "$arg" in
    --run|run) RUN=1 ;;
    --update|update) UPDATE=1 ;;
  esac
done

if [ -f "$0" ]; then
  # executed as a file from inside a checkout
  cd "$(dirname "$0")"
else
  # piped (curl ... | bash): $0 is "bash", so bootstrap a clone first
  if [ -d "$DIR" ]; then
    cd "$DIR"
  else
    git clone "$REPO_URL"
    cd "$DIR"
  fi
fi

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
