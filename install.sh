#!/usr/bin/env bash
set -euo pipefail

WebAPIRepoURL='https://github.com/ES-SR/WebAPI.git'
RepoDir='WebAPI'

Help=0
Run=0
Update=0
ServerArgs=()

while (( $# )); do
  arg="$1"
  flag="${arg%%=*}"
  val="${arg#*=}"
  has_eq=0
  [[ "$arg" == *=* ]] && has_eq=1

  shopt -s nocasematch
  case "$flag" in
    help|-h|--help)
      Help=1
      ;;
    run|-r|--run)
      Run=1
      ;;
    update|-u|--update)
      Update=1
      ;;
    port|ports|-p|--port|--ports)
      if (( has_eq )); then
        ServerArgs+=("--port=$val")
      else
        ServerArgs+=("--port=${2:-}")
        shift || true
      fi
      ;;
    host|host-addr|host-address|addr|address|-ha|--host|--host-addr|--host-address|--addr|--address)
      if (( has_eq )); then
        ServerArgs+=("--host-address=$val")
      else
        ServerArgs+=("--host-address=${2:-}")
        shift || true
      fi
      ;;
    conf|config|configuration|conf-file|config-file|configuration-file|-c|-cf|--conf|--config|--configuration|--conf-file|--config-file|--configuration-file)
      if (( has_eq )); then
        ServerArgs+=("--config-file=$val")
      else
        ServerArgs+=("--config-file=${2:-}")
        shift || true
      fi
      ;;
  esac
  shopt -u nocasematch
  shift
done

if (( Help )); then
  cat <<'EOF'
Usage: install.sh [Help] [Update] [Run] [Port=<0-65535>] [HostAddress=<addr>] [ConfigFile=<path>]

Flags (case-insensitive, supports --flag, -short, or flag=value):
  -h,  --help                  Show this help message
  -u,  --update                Pull latest changes if repository already exists
  -r,  --run                   Start the static server in the background and print its PID
  -p,  --port <0-65535>        Port override for server.ts (default from config.json: 3000)
  -ha, --host-address <addr>   Bind address override for server.ts (default from config.json: 127.0.0.1)
  -cf, --config-file <path>    Path to JSON config file (default: ./config.json)
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
  node server.ts "${ServerArgs[@]}" &
  echo "$!"
fi
