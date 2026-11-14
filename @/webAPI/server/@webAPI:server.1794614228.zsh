#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases

(( ! ${+functions[__@args:parse]} )) && {
	local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
	. <(2>/dev/null curl -fsSL "${ArgParserURL}" --)
	. "${${(%):-%x}:A}" "${(@)argv}"
	return
}

function @webAPI:server {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases
	{
		local ScriptRoot="${${(%):-%x}:A:h:h:h:h}"
		[[ -f "${ScriptRoot}/@webAPI" ]] || ScriptRoot="${PWD}"
		(( ${+functions[__@webAPI:paths:resolve]} )) || . "${ScriptRoot}/@/webAPI/env/__@webAPI:env.zsh"

		local -a ConfigSpecs=( HostAddr.ess:1 Port:1 Conf.ig.uration.File:1 )

		(( ${#${(k)WebAPIPaths}} )) || {
			local -A WebAPIPaths=()
			__@webAPI:paths:resolve
		}

		function __@webAPI:server:state:read {
			[[ -f "${WebAPIPaths[StateFile]}" ]] || return 1
			local -a StateLines=("${$(<"${WebAPIPaths[StateFile]}")//(#m)([[:space:]]#|)=([[:space:]]#|)/${MATCH// /}}")
			StateLines=("${(@fZ.C.)StateLines}")
			(( ${#${StateLines:-}} )) || return 1
			() {
				emulate -LR zsh -o extendedglob -o typesetsilent -o aliases
				@args:parse Pid:1 RepoDir:1 "${(@)ConfigSpecs}"
				ServerState=(
					Pid         "${Pid[1]}"
					HostAddress "${HostAddress[1]}"
					Port        "${Port[1]}"
					RepoDir     "${RepoDir[1]}"
				)
			} "${(@)StateLines}"
		}

		function __@webAPI:server:repo:ensure {
			local TargetDir="${1:-${WebAPIPaths[RepoDir]:-WebAPI}}"
			local WebAPIRepoURL='https://github.com/ES-SR/WebAPI.git'

			[[ "${PWD:t}" == "${TargetDir:t}" && -d .git ]] && {
				git pull --ff-only
				WebAPIPaths[RepoDir]="${PWD}"
				return 0
			}

			[[ -d "${TargetDir}/.git" ]] && {
				cd "${TargetDir}" || return 1
				git pull --ff-only
				WebAPIPaths[RepoDir]="${PWD}"
				return 0
			}

			git clone "${WebAPIRepoURL}" "${TargetDir}" && cd "${TargetDir}" || return 1
			WebAPIPaths[RepoDir]="${PWD}"
		}

		function __@webAPI:server:run {
			local RepoTarget="${Directory[1]:-${WebAPIPaths[RepoDir]:-WebAPI}}"
			[[ -n "${WebAPIPaths[RepoDir]}" && -f "${WebAPIPaths[RepoDir]}/server.ts" ]] || {
				[[ -f "server.ts" ]] && {
					WebAPIPaths[RepoDir]="${PWD}"
				} || {
					__@webAPI:server:repo:ensure "${RepoTarget}" || return 1
				}
			}

			local StateFile="${WebAPIPaths[StateFile]}"
			local -A ServerState=()
			__@webAPI:server:state:read && [[ -n "${ServerState[Pid]}" ]] && ( kill -0 "${ServerState[Pid]}" 2>/dev/null ) && {
				print "Server is already running (PID ${ServerState[Pid]} at http://${ServerState[HostAddress]}:${ServerState[Port]})."
				return 0
			}

			mkdir -p "${WebAPIPaths[StateDir]}"

			local -a NodeArgs=( "--host-address=${ServerArgs[HostAddress]}" "--port=${ServerArgs[Port]}" )
			[[ -n "${ServerArgs[ConfigurationFile]}" ]] && NodeArgs+=( "--configuration-file=${ServerArgs[ConfigurationFile]}" )

			node "${WebAPIPaths[RepoDir]}/server.ts" "${(@)NodeArgs}" >/dev/null 2>&1 &
			local ServerPid=$!

			cat > "${StateFile}" <<-EOF
				Pid = ${ServerPid}
				HostAddress = ${ServerArgs[HostAddress]}
				Port = ${ServerArgs[Port]}
				RepoDir = ${WebAPIPaths[RepoDir]}
			EOF

			print "${ServerPid}"
		}

		function __@webAPI:server:stop {
			local StateFile="${WebAPIPaths[StateFile]}"
			[[ ! -f "${StateFile}" ]] && {
				print "No recorded server state found at ${StateFile}."
				return 1
			}

			local -A ServerState=()
			__@webAPI:server:state:read
			local Pid="${ServerState[Pid]}"

			[[ -n "${Pid}" ]] && ( kill -0 "${Pid}" 2>/dev/null ) && {
				kill -TERM "${Pid}"
				print "Stopped server (PID ${Pid})."
			} || {
				print "Server process ${Pid} was not running."
			}
			rm -f "${StateFile}"
		}

		function __@webAPI:server:status {
			local -A ServerState=()
			__@webAPI:server:state:read && [[ -n "${ServerState[Pid]}" ]] && ( kill -0 "${ServerState[Pid]}" 2>/dev/null ) && {
				print "Running: PID=${ServerState[Pid]} URL=http://${ServerState[HostAddress]}:${ServerState[Port]}"
				return 0
			} || {
				print "Stopped"
				return 1
			}
		}

		function __@webAPI:server:update {
			local UpdateFile="${ScriptRoot}/@/webAPI/update/__@webAPI:update.zsh"
			[[ -f "${UpdateFile}" ]] && {
				. "${UpdateFile}"
				function __@webAPI:repo:ensure { __@webAPI:server:repo:ensure "${(@)argv}"; }
				__@webAPI:update
			} || {
				local RepoTarget="${Directory[1]:-${WebAPIPaths[RepoDir]:-WebAPI}}"
				__@webAPI:server:repo:ensure "${RepoTarget}"
			}
		}

		function __@webAPI:server:configure {
			local CfgTarget="${ServerArgs[ConfigurationFile]:-webAPI.conf}"
			(( ${#argv} )) || {
				print -r -- "ConfigurationFile=${CfgTarget}"
				print -r -- "HostAddress=${ServerArgs[HostAddress]}"
				print -r -- "Port=${ServerArgs[Port]}"
				return 0
			}
			mkdir -p "${CfgTarget:h}"
			local -A CfgMap=(
				HostAddress "${ServerArgs[HostAddress]}"
				Port        "${ServerArgs[Port]}"
			)
			local Item
			for Item ( "${(@)argv}" ) {
				[[ "${Item}" == *"="* ]] && {
					CfgMap[${Item%%=*}]="${Item#*=}"
				}
			}
			cat > "${CfgTarget}" <<-EOF
				HostAddress = ${CfgMap[HostAddress]}
				Port = ${CfgMap[Port]}
			EOF
			print -r -- "Updated ${CfgTarget}"
		}

		local -a CliArgs=( "${(@)argv}" )
		(( ${#${(k)ServerArgs}} )) || {
			local -A ServerArgs=()
			local -a RemainingArgv=()
			__@webAPI:config:resolve "${(@)CliArgs}"
			CliArgs=( "${(@)RemainingArgv}" )
		}

		local -a ServerCommandNames=( Run Stop Status Info State Update Configure )
		local -a ServerCommandSpecs=( Run Stop Status Info State Update Configure Dir.ectory:1 )
		set -- "${(@)CliArgs}"
		@args:parse "${(@)ServerCommandSpecs}"

		local -i ExitCode=0 Dispatched=0
		local S
		for S ( ${ServerCommandNames} ) {
			local Vals=( ${(P)S} )
			(( ${#Vals[1]/0/} )) && {
				Dispatched=1
				local Sub="${(L)S}"
				[[ "${Sub}" == (info|state) ]] && Sub="status"
				"__@webAPI:server:${Sub}" "${(@)Argv}" || ExitCode=$?
			}
		}

		(( Dispatched )) || {
			__@webAPI:server:status || ExitCode=$?
		}
		return ${ExitCode}
	} always {
		unfunction \
			__@webAPI:server:state:read \
			__@webAPI:server:repo:ensure \
			__@webAPI:server:run \
			__@webAPI:server:stop \
			__@webAPI:server:status \
			__@webAPI:server:update \
			__@webAPI:server:configure \
			2>/dev/null
	}
}

[[ "${ZSH_EVAL_CONTEXT}" == *:file* ]] || @webAPI:server "${(@)argv}"
