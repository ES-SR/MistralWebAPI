#!/usr/bin/env bash
set -euo pipefail

WebAPIRepoURL='https://github.com/ES-SR/MistralWebAPI.git'
RepoDir='MistralWebAPI'

Help=0
Run=0
Update=0

for arg in "$@"; do
  case "${arg#--}" in
    help|Help|-h) Help=1 ;;
    run|Run)      Run=1 ;;
    update|Update) Update=1 ;;
  esac
done

if (( Help )); then
  cat <<'EOF'
Usage: install.sh [--help] [--update] [--run]

  --help     Show this help message
  --update   Pull latest changes if repository already exists
  --run      Start the static server in the background and print its PID
EOF
  exit 0
fi

if [[ ${PWD##*/} == "$RepoDir" && -d .git ]]; then
  git pull --ff-only
elif [[ -d "$RepoDir/.git" ]]; then
  cd "$RepoDir"
  git pull --ff-only
else
  git clone "$WebAPIRepoURL" "$RepoDir"
  cd "$RepoDir"
fi

if (( Run )); then
  node server.ts &
  echo "$!"
fi
