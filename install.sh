#!/bin/sh
# Setup script. Run it either way:
#
#   1. Piped (the README one-liner):
#        curl -fsSL https://raw.githubusercontent.com/ES-SR/MistralWebAPI/refs/heads/<branch>/install.sh | bash -s -- [--update] [--run]
#      Clones into ./MistralWebAPI if missing (otherwise reuses it), then installs + builds.
#   2. From a checkout:
#        ./install.sh [--update] [--run]
#
# Flags:
#   --run      start the server after building (npm start)
#   --update   pull latest code first; when run from a checkout, the latest
#              install.sh is re-downloaded from the remote and executed, so
#              updates always run with the updated script (same as the README
#              command with --update)
#
# The server needs no API key; you add yours in the UI (Settings -> API -> Save).
set -eu

REPO_URL="https://github.com/ES-SR/MistralWebAPI.git"
RAW_BASE="https://raw.githubusercontent.com/ES-SR/MistralWebAPI/refs/heads"
DIR="MistralWebAPI"

RUN=0
UPDATE=0
UPDATED=0
IN_PLACE=0
for arg in "$@"; do
  case "$arg" in
    --run|run) RUN=1 ;;
    --update|update) UPDATE=1 ;;
    --updated) UPDATED=1 ;;
    --in-place) IN_PLACE=1 ;;
  esac
done

if [ "$IN_PLACE" = "1" ]; then
  : # already inside the checkout
elif [ -f "$0" ]; then
  cd "$(dirname "$0")"
else
  # piped (curl ... | bash): bootstrap a clone first
  if [ -d "$DIR" ]; then
    cd "$DIR"
  else
    git clone "$REPO_URL"
    cd "$DIR"
  fi
fi

if [ "$UPDATE" = "1" ] && [ "$UPDATED" = "0" ]; then
  git pull --ff-only || echo "warning: git pull failed; continuing with the current checkout" >&2
  if [ "$IN_PLACE" = "0" ] && [ -f "$0" ]; then
    # run as ./install.sh inside a checkout: re-run the latest script from the
    # remote (exactly the README command), marked --updated to avoid recursion
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "trunk")
    EXTRA=""
    if [ "$RUN" = "1" ]; then EXTRA="--run"; fi
    curl -fsSL "$RAW_BASE/$BRANCH/install.sh" | bash -s -- --updated --in-place $EXTRA
    exit
  fi
fi

npm install
npm run build

if [ "$RUN" = "1" ]; then
  exec npm start
else
  echo "Build done. Start the app with: npm start  (then open http://127.0.0.1:3000)"
fi
