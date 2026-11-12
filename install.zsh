#!/usr/bin/env zsh

() {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops
	(( ${+functions[__@args:parse]} )) && return 0
	local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
	. <(2>/dev/null curl -fsSL "${ArgParserURL}" --)
}

function @webAPI {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases
	{
		local -A WebAPIPaths=()

		function __@webAPI:help {
			<<-"@webAPI:help.EOF"
				Usage: @webAPI [Command] [Options]

				Server & Lifecycle Commands:
				  Help                          Show this help message
				  Install                       Clone/update repo and interactively install @webAPI (uses vared)
				  Update                        Pull latest repository changes (git pull --ff-only)
				  Start | Run                   Start the static server in the background and record its state
				  Stop                          Stop the running background server recorded in XDG state/runtime
				  Status                        Report whether the background server is running, its PID, and URL

				Web-Terminal Bridge & JSON Commands:
				  BridgeState                   Inspect connected browser UI clients, active provider/op, and state
				  BridgeResponse                Fetch the latest response from the browser UI (pipeable to Extract)
				  Select <provider> [op]        Switch the active provider and/or operation in the browser UI
				  Fill <Key=Val...>             Populate form parameters in the active browser UI operation
				  Send [prov:op] <Key=Val...>   Fill and execute an operation in the browser UI and print response
				  Listen                        Stream live SSE events (commands & responses) from the bridge
				  Extract <key...>              Extract Key=Value pairs from JSON on stdin by key name (no jq path needed)

				Options (case-insensitive, supports --flag, -short, or flag=value):
				  -p,  --port <0-65535>             Port override for server.ts (default: 3000)
				  -ha, --host-address <addr>        Bind address override for server.ts (default: 127.0.0.1)
				  -cf, --configuration-file <path>  Path to config file (default: ./config.conf)
				  -d,  --directory <path>           Repository directory override
			@webAPI:help.EOF
		}

		function __@webAPI:paths:resolve {
			local -a UserPathDirs=( "${(@M)path:#${HOME}/*}" )
			local -a UserFpathDirs=( "${(@M)fpath:#${HOME}/*}" )
			local DefaultBinDir="${XDG_BIN_HOME:-${UserPathDirs[1]:-${HOME}/.local/bin}}"
			local DefaultFuncDir="${UserFpathDirs[1]:-${XDG_DATA_HOME:-${HOME}/.local/share}/zsh/site-functions}"
			local DefaultDataDir="${XDG_DATA_HOME:-${${(s.:.)XDG_DATA_DIRS}[1]:-${HOME}/.local/share}}/webapi"
			local DefaultConfigDir="${XDG_CONFIG_HOME:-${${(s.:.)XDG_CONFIG_DIRS}[1]:-${HOME}/.config}}/webapi"
			local DefaultStateDir="${XDG_RUNTIME_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}}/webapi"

			WebAPIPaths=(
				BinDir     "${DefaultBinDir}"
				FuncDir    "${DefaultFuncDir}"
				DataDir    "${DefaultDataDir}"
				ConfigDir  "${DefaultConfigDir}"
				StateDir   "${DefaultStateDir}"
				StateFile  "${DefaultStateDir}/server.state"
			)
		}

		function __@webAPI:repo:ensure {
			local TargetDir="${1:-MistralWebAPI}"
			local WebAPIRepoURL='https://github.com/ES-SR/MistralWebAPI.git'

			if [[ "${PWD:t}" == "${TargetDir:t}" && -d .git ]] {
				(( Update )) && git pull --ff-only
				WebAPIPaths[RepoDir]="${PWD}"
				return 0
			}

			if [[ -d "${TargetDir}/.git" ]] {
				cd "${TargetDir}" || return 1
				git pull --ff-only
				WebAPIPaths[RepoDir]="${PWD}"
				return 0
			}

			git clone "${WebAPIRepoURL}" "${TargetDir}" && cd "${TargetDir}" || return 1
			WebAPIPaths[RepoDir]="${PWD}"
		}

		function __@webAPI:install {
			local RepoTarget="${Directory[1]:-${PWD}/MistralWebAPI}"
			if [[ "${PWD:t}" == "MistralWebAPI" && -d .git ]] {
				RepoTarget="${PWD}"
			}

			if [[ -t 0 ]] {
				vared -p "Repository directory: " -c RepoTarget
			}
			[[ -n "${RepoTarget}" ]] || return 1

			__@webAPI:repo:ensure "${RepoTarget}" || return 1

			local WrapperDir="${WebAPIPaths[BinDir]}"
			if [[ -t 0 ]] {
				vared -p "Directory for '@webAPI' CLI wrapper (leave empty to skip): " -c WrapperDir
			}

			if [[ -n "${WrapperDir}" ]] {
				mkdir -p "${WrapperDir}"
				local WrapperPath="${WrapperDir}/@webAPI"
				cat > "${WrapperPath}" <<-EOF
					#!/usr/bin/env zsh
					source "${WebAPIPaths[RepoDir]}/install.zsh"
					@webAPI "\${(@)argv}"
				EOF
				chmod +x "${WrapperPath}"
				print "Installed CLI wrapper: ${WrapperPath}"
				if (( ! ${path[(Ie)${WrapperDir}]} )) {
					print "Note: ${WrapperDir} is not currently in \$path."
				}
			}
		}

		function __@webAPI:update {
			local RepoTarget="${Directory[1]:-MistralWebAPI}"
			__@webAPI:repo:ensure "${RepoTarget}"
		}

		function __@webAPI:start {
			local CliPort="${Port[1]}" CliHost="${HostAddress[1]}" CliConfig="${ConfigurationFile[1]}"
			local RepoTarget="${Directory[1]:-MistralWebAPI}"
			if [[ ! -f "server.ts" ]] {
				__@webAPI:repo:ensure "${RepoTarget}" || return 1
			} else {
				WebAPIPaths[RepoDir]="${PWD}"
			}

			local StateFile="${WebAPIPaths[StateFile]}"
			local Pid="" Host="127.0.0.1" Port="3000" RepoDir="${WebAPIPaths[RepoDir]}"
			if [[ -f "${StateFile}" ]] {
				. <(print -rl -- "${(@)${(@f)$(<"${StateFile}")}//[[:space:]]/}")
				if [[ -n "${Pid}" ]] && ( kill -0 "${Pid}" 2>/dev/null ) {
					print "Server is already running (PID ${Pid} at http://${Host}:${Port})."
					return 0
				}
			}

			local CfgFile="${CliConfig:-${WebAPIPaths[RepoDir]}/config.conf}"
			if [[ -f "${CfgFile}" ]] {
				. <(print -rl -- "${(@)${(@f)$(<"${CfgFile}")}//[[:space:]]/}")
			}

			mkdir -p "${WebAPIPaths[StateDir]}"

			local BindHost="${CliHost:-${Host}}"
			local BindPort="${CliPort:-${Port}}"
			local -a ServerArgs=( "--host-address=${BindHost}" "--port=${BindPort}" )
			[[ -n "${CliConfig}" ]] && ServerArgs+=( "--configuration-file=${CliConfig}" )

			node "${WebAPIPaths[RepoDir]}/server.ts" "${(@)ServerArgs}" >/dev/null 2>&1 &
			local ServerPid=$!

			cat > "${StateFile}" <<-EOF
				Pid = ${ServerPid}
				Host = ${BindHost}
				Port = ${BindPort}
				RepoDir = ${WebAPIPaths[RepoDir]}
			EOF

			print "${ServerPid}"
		}

		function __@webAPI:stop {
			local StateFile="${WebAPIPaths[StateFile]}"
			if [[ ! -f "${StateFile}" ]] {
				print "No recorded server state found at ${StateFile}."
				return 1
			}

			local Pid="" Host="" Port="" RepoDir=""
			. <(print -rl -- "${(@)${(@f)$(<"${StateFile}")}//[[:space:]]/}")

			if [[ -n "${Pid}" ]] && ( kill -0 "${Pid}" 2>/dev/null ) {
				kill -TERM "${Pid}"
				print "Stopped server (PID ${Pid})."
			} else {
				print "Server process ${Pid} was not running."
			}
			rm -f "${StateFile}"
		}

		function __@webAPI:status {
			local StateFile="${WebAPIPaths[StateFile]}"
			if [[ -f "${StateFile}" ]] {
				local Pid="" Host="" Port="" RepoDir=""
				. <(print -rl -- "${(@)${(@f)$(<"${StateFile}")}//[[:space:]]/}")
				if [[ -n "${Pid}" ]] && ( kill -0 "${Pid}" 2>/dev/null ) {
					print "Running: PID=${Pid} URL=http://${Host}:${Port}"
					return 0
				}
			}
			print "Stopped"
			return 1
		}

		function __@webAPI:bridge:url {
			local StateFile="${WebAPIPaths[StateFile]}"
			local Pid="" Host="127.0.0.1" Port="3000" RepoDir="${PWD}"
			local CfgFile="${ConfigurationFile[1]:-${PWD}/config.conf}"
			if [[ -f "${CfgFile}" ]] {
				. <(print -rl -- "${(@)${(@f)$(<"${CfgFile}")}//[[:space:]]/}")
			}
			if [[ -f "${StateFile}" ]] {
				. <(print -rl -- "${(@)${(@f)$(<"${StateFile}")}//[[:space:]]/}")
			}
			local BindHost="${HostAddress[1]:-${Host}}"
			local BindPort="${Port[1]:-${Port}}"
			print -r -- "http://${BindHost}:${BindPort}"
		}

		function __@webAPI:bridge:params {
			local -a Pairs=()
			local Item Key Val EscVal
			for Item ( "${(@)argv}" ) {
				if [[ "${Item}" == *"="* ]] {
					Key="${Item%%=*}"
					Val="${Item#*=}"
					if [[ "${Val}" == (true|false|<->|<->.<->) ]] {
						Pairs+=( "\"${Key}\":${Val}" )
					} else {
						EscVal="${${Val//\\/\\\\}//\"/\\\"}"
						Pairs+=( "\"${Key}\":\"${EscVal}\"" )
					}
				}
			}
			print -r -- "{${(j.,.)Pairs}}"
		}

		function __@webAPI:bridge:state {
			local BridgeURL="$(__@webAPI:bridge:url)"
			curl -fsSL "${BridgeURL}/bridge/state"
			print ""
		}

		function __@webAPI:bridge:response {
			local BridgeURL="$(__@webAPI:bridge:url)"
			local StateJson="$(curl -fsSL "${BridgeURL}/bridge/state")"
			if (( ${#Extract} )) {
				print -r -- "${StateJson}" | __@webAPI:json:extract "${(@)Extract}"
			} else {
				print -r -- "${StateJson}"
			}
		}

		function __@webAPI:bridge:select {
			local BridgeURL="$(__@webAPI:bridge:url)"
			local TargetProv="${1}" TargetOp=""
			local -a RestArgs=( "${(@)argv[2,-1]}" )
			if [[ "${TargetProv}" == *":"* ]] {
				TargetOp="${TargetProv#*:}"
				TargetProv="${TargetProv%%:*}"
			} elif (( ${#RestArgs} )) && [[ "${RestArgs[1]}" != *"="* ]] {
				TargetOp="${RestArgs[1]}"
				RestArgs=( "${(@)RestArgs[2,-1]}" )
			}
			local ParamsJson="$(__@webAPI:bridge:params "${(@)RestArgs}")"
			local Payload="{\"action\":\"select\",\"provider\":\"${TargetProv}\",\"operation\":\"${TargetOp}\",\"params\":${ParamsJson}}"
			curl -fsSL -X POST -H "Content-Type: application/json" -d "${Payload}" "${BridgeURL}/bridge/command"
			print ""
		}

		function __@webAPI:bridge:fill {
			local BridgeURL="$(__@webAPI:bridge:url)"
			local ParamsJson="$(__@webAPI:bridge:params "${(@)argv}")"
			local Payload="{\"action\":\"fill\",\"params\":${ParamsJson}}"
			curl -fsSL -X POST -H "Content-Type: application/json" -d "${Payload}" "${BridgeURL}/bridge/command"
			print ""
		}

		function __@webAPI:bridge:send {
			local BridgeURL="$(__@webAPI:bridge:url)"
			local TargetProv="" TargetOp=""
			local -a ParamArgs=( "${(@)argv}" )
			if (( ${#ParamArgs} )) && [[ "${ParamArgs[1]}" != *"="* ]] {
				if [[ "${ParamArgs[1]}" == *":"* ]] {
					TargetProv="${ParamArgs[1]%%:*}"
					TargetOp="${ParamArgs[1]#*:}"
				} else {
					TargetOp="${ParamArgs[1]}"
				}
				ParamArgs=( "${(@)ParamArgs[2,-1]}" )
			}
			local ParamsJson="$(__@webAPI:bridge:params "${(@)ParamArgs}")"
			local Payload="{\"action\":\"execute\",\"wait\":true,\"provider\":\"${TargetProv}\",\"operation\":\"${TargetOp}\",\"params\":${ParamsJson}}"
			local RespJson="$(curl -fsSL -X POST -H "Content-Type: application/json" -d "${Payload}" "${BridgeURL}/bridge/command")"
			if (( ${#Extract} )) {
				print -r -- "${RespJson}" | __@webAPI:json:extract "${(@)Extract}"
			} else {
				print -r -- "${RespJson}"
			}
		}

		function __@webAPI:bridge:listen {
			local BridgeURL="$(__@webAPI:bridge:url)"
			curl -sSN "${BridgeURL}/bridge/events"
		}

		function __@webAPI:json:extract {
			local JsonInput
			JsonInput="$(<&0)"
			[[ -n "${JsonInput}" ]] || return 1

			local Key Pattern MatchVal
			for Key ( "${(@)argv}" ) {
				Pattern="\"${Key}\"[[:space:]]*:[[:space:]]*(\"([^\"]|\\\\\")*\"|[^,}\n[:space:]]+)"
				local Remaining="${JsonInput}"
				while [[ "${Remaining}" =~ ${Pattern} ]] {
					MatchVal="${match[1]}"
					MatchVal="${${MatchVal#\"}%\"}"
					print -r -- "${Key}=${MatchVal}"
					Remaining="${Remaining[$(( MEND + 1 )),-1]}"
				}
			}
		}

		(( ARGC )) || {
			__@webAPI:help
			return 0
		}

		@args:parse \
			Help \
			Install \
			Update \
			Start \
			Run \
			Stop \
			Status \
			Bridge.State \
			Bridge.Resp.onse \
			Select:+ \
			Fill:+ \
			Send:+ \
			Listen \
			Extract:+ \
			Port:1 \
			Host.Addr.ess:1 \
			Conf.ig.uration.File:1 \
			Dir.ectory:1

		set -- "${(@)Argv}"

		__@webAPI:paths:resolve

		(( Help )) && {
			__@webAPI:help
			return 0
		}

		(( Install ))          && { __@webAPI:install }
		(( Update ))           && { __@webAPI:update }
		(( Start || Run ))     && { __@webAPI:start }
		(( Stop ))             && { __@webAPI:stop }
		(( Status ))           && { __@webAPI:status }
		(( BridgeState ))      && { __@webAPI:bridge:state }
		(( BridgeResponse ))   && { __@webAPI:bridge:response }
		(( ${#Select} ))       && { __@webAPI:bridge:select "${(@)Select}" }
		(( ${#Fill} ))         && { __@webAPI:bridge:fill "${(@)Fill}" }
		(( ${#Send} ))         && { __@webAPI:bridge:send "${(@)Send}" }
		(( Listen ))           && { __@webAPI:bridge:listen }
		(( ${#Extract} && ! BridgeResponse && ! ${#Send} )) && { __@webAPI:json:extract "${(@)Extract}" }
	} always {
		unfunction \
			__@webAPI:help \
			__@webAPI:paths:resolve \
			__@webAPI:repo:ensure \
			__@webAPI:install \
			__@webAPI:update \
			__@webAPI:start \
			__@webAPI:stop \
			__@webAPI:status \
			__@webAPI:bridge:url \
			__@webAPI:bridge:params \
			__@webAPI:bridge:state \
			__@webAPI:bridge:response \
			__@webAPI:bridge:select \
			__@webAPI:bridge:fill \
			__@webAPI:bridge:send \
			__@webAPI:bridge:listen \
			__@webAPI:json:extract \
			2>/dev/null
	}
}

if [[ "${ZSH_EVAL_CONTEXT}" == "toplevel" ]] || (( ARGC )) {
	@webAPI "${(@)argv}"
}
