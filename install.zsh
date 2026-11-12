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
				  Help                               Show this help message
				  Install                            Clone/update repo and interactively install @webAPI (uses vared)
				  Update                             Pull latest repository changes (git pull --ff-only)
				  Server[.Run] | ServerLaunch        Start the static server in the background and record its state (-sr / -sl)
				  ServerStop                         Stop the running background server recorded in XDG state/runtime (-ss)
				  ServerCheck                        Report whether the background server is running, its PID, and URL (-sc)

				Web-Terminal Bridge & JSON Commands:
				  Bridge[.Info]                      Inspect connected browser UI clients, active provider/op, and state (-bi)
				  BridgeResponse                     Fetch the latest response from the browser UI (-br)
				  BridgeOperation <provider> [op]    Switch the active provider and/or operation in the browser UI (-bo)
				  BridgeFill <Key=Val...>            Populate form parameters in the active browser UI operation (-bf)
				  BridgeSend [prov:op] <Key=Val...>  Fill and execute an operation in the browser UI and print response (-bs)
				  BridgeListen                       Stream live SSE events (commands & responses) from the bridge (-bl)
				  Extract[.Keys] <key...>            Extract Key=Value pairs from JSON on stdin by key name (-ek)

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
			local InstallConf="${DefaultConfigDir}/install.conf"

			local RepoDir="" FuncDir="${DefaultFuncDir}" BinDir="${DefaultBinDir}"
			if [[ -f "${InstallConf}" ]] {
				. <(print -rl -- "${(@)${(@f)$(<"${InstallConf}")}//[[:space:]]/}")
			}

			WebAPIPaths=(
				RepoDir      "${RepoDir}"
				BinDir       "${BinDir}"
				FuncDir      "${FuncDir}"
				DataDir      "${DefaultDataDir}"
				ConfigDir    "${DefaultConfigDir}"
				InstallConf  "${InstallConf}"
				StateDir     "${DefaultStateDir}"
				StateFile    "${DefaultStateDir}/server.state"
			)
		}

		function __@webAPI:repo:ensure {
			local TargetDir="${1:-${WebAPIPaths[RepoDir]:-WebAPI}}"
			local WebAPIRepoURL='https://github.com/ES-SR/WebAPI.git'

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
			local RepoTarget="${Directory[1]:-${WebAPIPaths[RepoDir]:-${PWD}/WebAPI}}"
			if [[ -f "${PWD}/server.ts" && -d "${PWD}/.git" ]] {
				RepoTarget="${PWD}"
			}

			if [[ -t 0 ]] {
				vared -p "Repository directory: " -c RepoTarget
			}
			[[ -n "${RepoTarget}" ]] || return 1

			__@webAPI:repo:ensure "${RepoTarget}" || return 1

			local FuncDir="${WebAPIPaths[FuncDir]}"
			if [[ -t 0 ]] {
				vared -p "Directory to install '@webAPI' & '_@webAPI' functions (leave empty to skip): " -c FuncDir
			}

			if [[ -n "${FuncDir}" ]] {
				mkdir -p "${FuncDir}" "${WebAPIPaths[ConfigDir]}"
				cat > "${WebAPIPaths[InstallConf]}" <<-EOF
					RepoDir = ${WebAPIPaths[RepoDir]}
					FuncDir = ${FuncDir}
				EOF

				local FuncPath="${FuncDir}/@webAPI"
				cat > "${FuncPath}" <<-EOF
					#!/usr/bin/env zsh
					#autoload
					() {
						emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops
						(( \${+functions[__@args:parse]} )) && return 0
						local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
						. <(2>/dev/null curl -fsSL "\${ArgParserURL}" --)
					}
					$(typeset -f @webAPI)
					@webAPI "\${(@)argv}"
				EOF
				chmod +x "${FuncPath}"

				local CompPath="${FuncDir}/_@webAPI"
				cat > "${CompPath}" <<-EOF
					#compdef @webAPI
					() {
						emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops
						(( \${+functions[@args:parse:generatePattern]} )) && return 0
						local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
						. <(2>/dev/null curl -fsSL "\${ArgParserURL}" --)
					}
					$(typeset -f _@webAPI)
					_@webAPI "\${(@)argv}"
				EOF

				print "Installed standalone '@webAPI' and '_@webAPI' into ${FuncDir}"

				local AddFpath="yes"
				if [[ -t 0 ]] {
					vared -p "Add ${FuncDir} to \$fpath and autoload @webAPI? [yes/no]: " -c AddFpath
				}

				if [[ "${AddFpath}" == (#i)y(es|) ]] {
					if (( ! ${fpath[(Ie)${FuncDir}]} )) {
						fpath=( "${FuncDir}" "${(@)fpath}" )
					}
					autoload -Uz @webAPI _@webAPI
					(( ${+functions[compdef]} )) && compdef _@webAPI @webAPI

					local ZshRcFile="${ZDOTDIR:-${HOME}}/.zshrc"
					if [[ -t 0 ]] {
						vared -p "Zsh startup file to persist fpath & autoload (leave empty to skip): " -c ZshRcFile
					}

					if [[ -n "${ZshRcFile}" ]] {
						if [[ ! -f "${ZshRcFile}" || "$(<"${ZshRcFile}")" != *"autoload -Uz @webAPI"* ]] {
							cat >> "${ZshRcFile}" <<-EOF

								# @webAPI CLI & completion
								(( \${fpath[(Ie)${FuncDir}]} )) || fpath=( "${FuncDir}" "\${(@)fpath}" )
								autoload -Uz @webAPI _@webAPI
								(( \${+functions[compdef]} )) && compdef _@webAPI @webAPI
							EOF
							print "Added fpath & autoload configuration to ${ZshRcFile}"
						} else {
							print "${ZshRcFile} already contains @webAPI autoload configuration."
						}
					}
				}
			}
		}

		function __@webAPI:update {
			local RepoTarget="${Directory[1]:-${WebAPIPaths[RepoDir]:-WebAPI}}"
			__@webAPI:repo:ensure "${RepoTarget}"
		}

		function __@webAPI:start {
			local CliPort="${Port[1]}" CliHost="${HostAddress[1]}" CliConfig="${ConfigurationFile[1]}"
			local RepoTarget="${Directory[1]:-${WebAPIPaths[RepoDir]:-WebAPI}}"
			if [[ -n "${WebAPIPaths[RepoDir]}" && -f "${WebAPIPaths[RepoDir]}/server.ts" ]] {
				: # RepoDir already resolved from install.conf
			} elif [[ -f "server.ts" ]] {
				WebAPIPaths[RepoDir]="${PWD}"
			} else {
				__@webAPI:repo:ensure "${RepoTarget}" || return 1
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
			if (( ${#ExtractKeys} )) {
				print -r -- "${StateJson}" | __@webAPI:json:extract "${(@)ExtractKeys}"
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
			if (( ${#ExtractKeys} )) {
				print -r -- "${RespJson}" | __@webAPI:json:extract "${(@)ExtractKeys}"
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
			Server.Run \
			ServerLaunch \
			ServerStop \
			ServerCheck \
			Bridge.Info \
			BridgeResp.onse \
			BridgeOp.eration:+ \
			BridgeFill:+ \
			BridgeSend:+ \
			BridgeListen \
			Extract.Key/s:+ \
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

		(( Install ))                       && { __@webAPI:install }
		(( Update ))                        && { __@webAPI:update }
		(( ServerRun || ServerLaunch ))     && { __@webAPI:start }
		(( ServerStop ))                    && { __@webAPI:stop }
		(( ServerCheck ))                   && { __@webAPI:status }
		(( BridgeInfo ))                    && { __@webAPI:bridge:state }
		(( BridgeResponse ))                && { __@webAPI:bridge:response }
		(( ${#BridgeOperation} ))           && { __@webAPI:bridge:select "${(@)BridgeOperation}" }
		(( ${#BridgeFill} ))                && { __@webAPI:bridge:fill "${(@)BridgeFill}" }
		(( ${#BridgeSend} ))                && { __@webAPI:bridge:send "${(@)BridgeSend}" }
		(( BridgeListen ))                  && { __@webAPI:bridge:listen }
		(( ${#ExtractKeys} && ! BridgeResponse && ! ${#BridgeSend} )) && { __@webAPI:json:extract "${(@)ExtractKeys}" }
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

function _@webAPI {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops
	{
		function __@webAPI:complete:commands {
			local -a Commands=(
				'Help:Show help message'
				'Install:Clone/update repo and interactively install @webAPI (uses vared)'
				'Update:Pull latest repository changes (git pull --ff-only)'
				'ServerRun:Start the static server in the background and record its state (-sr / Server)'
				'ServerLaunch:Start the static server in the background and record its state (-sl)'
				'ServerStop:Stop the running background server recorded in XDG state/runtime (-ss)'
				'ServerCheck:Report whether the background server is running, its PID, and URL (-sc)'
				'BridgeInfo:Inspect connected browser UI clients, active provider/op, and state (-bi / Bridge)'
				'BridgeResponse:Fetch the latest response from the browser UI (-br)'
				'BridgeOperation:Switch the active provider and/or operation in the browser UI (-bo)'
				'BridgeFill:Populate form parameters in the active browser UI operation (-bf)'
				'BridgeSend:Fill and execute an operation in the browser UI and print response (-bs)'
				'BridgeListen:Stream live SSE events (commands & responses) from the bridge (-bl)'
				'ExtractKeys:Extract Key=Value pairs from JSON on stdin by key name (-ek)'
			)
			local -a Options=(
				'--port:Port override for server.ts (0-65535)'
				'--host-address:Bind address override for server.ts (default 127.0.0.1)'
				'--configuration-file:Path to Key=Value config file (default ./config.conf)'
				'--directory:Repository directory override'
			)
			_describe -t commands '@webAPI command' Commands
			_describe -t options '@webAPI option' Options
		}

		function __@webAPI:complete:port {
			local -a Ports=(
				'3000:Default playground port'
				'8080:Alternate HTTP development port'
				'8000:Alternate local server port'
				'0:OS-assigned ephemeral port'
			)
			_describe -t ports 'port' Ports
		}

		function __@webAPI:complete:host {
			local -a Hosts=(
				'127.0.0.1:IPv4 loopback (default)'
				'localhost:Localhost hostname'
				'::1:IPv6 loopback'
				'0.0.0.0:All IPv4 interfaces (use TLS proxy)'
			)
			_describe -t hosts 'bind address' Hosts
		}

		function __@webAPI:complete:config {
			_files -g '*.conf(-.)' -g '*(-.)'
		}

		function __@webAPI:complete:directory {
			_files -/
		}

		function __@webAPI:complete:targets {
			local -a Providers=(
				'mistral:Mistral AI API'
				'openai:OpenAI / OpenAI-compatible API'
				'anthropic:Anthropic Messages API'
				'gemini:Google Gemini API'
			)
			local -a Targets=(
				'mistral:chat.complete:Mistral chat completion'
				'mistral:chat.stream:Mistral streaming chat completion'
				'mistral:fim.complete:Mistral fill-in-the-middle completion'
				'mistral:embeddings.create:Mistral text embeddings'
				'mistral:models.list:Mistral list models'
				'openai:chat.completions:OpenAI chat completion'
				'openai:chat.completions.stream:OpenAI streaming chat completion'
				'openai:responses.create:OpenAI Responses API'
				'openai:embeddings.create:OpenAI embeddings'
				'openai:models.list:OpenAI list models'
				'anthropic:messages.create:Anthropic Messages create'
				'anthropic:messages.stream:Anthropic streaming Messages'
				'anthropic:models.list:Anthropic list models'
				'gemini:models.generateContent:Gemini generate content'
				'gemini:models.streamGenerateContent:Gemini stream generate content'
				'gemini:models.list:Gemini list models'
			)
			_describe -t providers 'provider' Providers
			_describe -t targets 'provider:operation' Targets
			__@webAPI:complete:params
		}

		function __@webAPI:complete:params {
			local -a ParamKeys=(
				'model'
				'temperature'
				'maxTokens'
				'topP'
				'messages'
				'prompt'
				'input'
				'instructions'
				'systemPrompt'
				'stream'
				'stop'
				'responseFormat'
			)
			compadd -S '=' -- "${(@)ParamKeys}"
		}

		function __@webAPI:complete:extract {
			local -a JsonKeys=(
				'id:Response or resource identifier'
				'content:Message content text'
				'text:Text segment'
				'readable:Bridge extracted readable text'
				'status:HTTP / bridge status label'
				'model:Model identifier'
				'role:Message role'
				'finish_reason:Completion stop reason'
				'total_tokens:Total token usage'
				'prompt_tokens:Prompt token usage'
				'completion_tokens:Completion token usage'
			)
			_describe -t keys 'JSON key to extract' JsonKeys
		}

		local -A ContextDispatch=(
			Port               __@webAPI:complete:port
			HostAddress        __@webAPI:complete:host
			ConfigurationFile  __@webAPI:complete:config
			Directory          __@webAPI:complete:directory
			BridgeOperation    __@webAPI:complete:targets
			BridgeFill         __@webAPI:complete:params
			BridgeSend         __@webAPI:complete:targets
			ExtractKeys        __@webAPI:complete:extract
		)

		local -A SpecMap=(
			Port               'Port'
			HostAddress        'Host.Addr.ess'
			ConfigurationFile  'Conf.ig.uration.File'
			Directory          'Dir.ectory'
			BridgeOperation    'BridgeOp.eration'
			BridgeFill         'BridgeFill'
			BridgeSend         'BridgeSend'
			ExtractKeys        'Extract.Key/s'
		)
		local -A FlagPats=()
		local CtxName RawPat
		for CtxName ( "${(@k)SpecMap}" ) {
			RawPat="$(@args:parse:generatePattern "${SpecMap[${CtxName}]}")"
			FlagPats[${CtxName}]="${RawPat%(\=\*|)(\#e)}(#e)"
		}

		local CurWord="${words[CURRENT]}"
		local PrevWord="${words[CURRENT-1]}"
		local ContextKey=""

		if [[ "${CurWord}" == (#b)([^=]##)=(*) ]] {
			local FlagPart="${match[1]}"
			for CtxName ( Port HostAddress ConfigurationFile Directory ) {
				[[ "${FlagPart}" == ${~FlagPats[${CtxName}]} ]] && {
					ContextKey="${CtxName}"
					break
				}
			}
			if [[ -n "${ContextKey}" ]] {
				compset -P '*='
				"${ContextDispatch[${ContextKey}]}"
				return 0
			}
		}

		for CtxName ( Port HostAddress ConfigurationFile Directory ) {
			[[ "${PrevWord}" == ${~FlagPats[${CtxName}]} ]] && {
				ContextKey="${CtxName}"
				break
			}
		}

		if [[ -z "${ContextKey}" ]] {
			local -i Idx
			for (( Idx = CURRENT - 1; Idx >= 2; Idx-- )) {
				local Word="${words[Idx]}"
				for CtxName ( BridgeOperation BridgeFill BridgeSend ExtractKeys ) {
					[[ "${Word}" == ${~FlagPats[${CtxName}]} ]] && {
						ContextKey="${CtxName}"
						break 2
					}
				}
			}
		}

		if [[ -n "${ContextKey}" ]] {
			"${ContextDispatch[${ContextKey}]}"
			if [[ "${ContextKey}" == (BridgeOperation|BridgeFill|BridgeSend|ExtractKeys) ]] {
				__@webAPI:complete:commands
			}
			return 0
		}

		__@webAPI:complete:commands
	} always {
		unfunction \
			__@webAPI:complete:commands \
			__@webAPI:complete:port \
			__@webAPI:complete:host \
			__@webAPI:complete:config \
			__@webAPI:complete:directory \
			__@webAPI:complete:targets \
			__@webAPI:complete:params \
			__@webAPI:complete:extract \
			2>/dev/null
	}
}

(( ${+functions[compdef]} )) && compdef _@webAPI @webAPI

if (( ARGC )) {
	@webAPI "${(@)argv}"
} else {
	@webAPI Install
}
