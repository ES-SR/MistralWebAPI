#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases

(( ! ${+functions[__@args:parse]} )) && {
	local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
	. <(2>/dev/null curl -fsSL "${ArgParserURL}" --)
	. "${${(%):-%x}:A}" "${(@)argv}"
	return
}

function @webAPI:events {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases
	{
		local ScriptRoot="${${(%):-%x}:A:h:h:h:h}"
		[[ -f "${ScriptRoot}/@webAPI" ]] || ScriptRoot="${PWD}"
		(( ${+functions[__@webAPI:paths:resolve]} )) || . "${ScriptRoot}/@/webAPI/env/__@webAPI:env.zsh"

		(( ${#${(k)WebAPIPaths}} )) || {
			local -A WebAPIPaths=()
			__@webAPI:paths:resolve
		}

		mkdir -p "${WebAPIPaths[StateDir]}"

		function __@webAPI:events:maxSize {
			[[ -f "${WebAPIPaths[EventsSize]}" ]] && {
				local Sz="$(<"${WebAPIPaths[EventsSize]}")"
				[[ "${Sz}" == <-> ]] && (( Sz > 0 )) && {
					print -r -- "${Sz}"
					return 0
				}
			}
			print -r -- "100"
		}

		function __@webAPI:events:queuesize {
			local NewSize="${1}"
			[[ -n "${NewSize}" ]] && {
				[[ "${NewSize}" == <-> ]] && (( NewSize > 0 )) || {
					print -u2 -- "queueSize must be a positive integer"
					return 1
				}
				print -r -- "${NewSize}" > "${WebAPIPaths[EventsSize]}"
				print -r -- "${NewSize}"
			} || {
				__@webAPI:events:maxSize
			}
		}

		function __@webAPI:events:read {
			local -i Count="${1:-1}"
			(( Count > 0 )) || Count=1
			[[ -f "${WebAPIPaths[EventsFile]}" ]] || return 1

			local -a Lines=( "${(@f)$(<"${WebAPIPaths[EventsFile]}")}" )
			local -i Total=${#Lines}
			(( Total )) || return 1

			local -i Cursor=1
			[[ -f "${WebAPIPaths[EventsCursor]}" ]] && {
				local RawCur="$(<"${WebAPIPaths[EventsCursor]}")"
				[[ "${RawCur}" == <-> ]] && (( RawCur >= 1 )) && Cursor=${RawCur}
			}
			(( Cursor > Total )) && return 1

			local -i EndIdx=$(( Cursor + Count - 1 ))
			(( EndIdx > Total )) && EndIdx=${Total}

			local -i I
			for (( I=Cursor; I<=EndIdx; I++ )) {
				print -r -- "${Lines[$I]}"
			}
			print -r -- "$(( EndIdx + 1 ))" > "${WebAPIPaths[EventsCursor]}"
		}

		function __@webAPI:events:clear {
			: >| "${WebAPIPaths[EventsFile]}"
			print -r -- "1" >| "${WebAPIPaths[EventsCursor]}"
		}

		function __@webAPI:events:pause {
			: >| "${WebAPIPaths[EventsPaused]}"
			print -r -- "Paused"
		}

		function __@webAPI:events:resume {
			rm -f "${WebAPIPaths[EventsPaused]}"
			print -r -- "Resumed"
		}

		function __@webAPI:events:start {
			[[ -f "${WebAPIPaths[EventsPid]}" ]] && {
				local OldPid="$(<"${WebAPIPaths[EventsPid]}")"
				[[ -n "${OldPid}" ]] && ( kill -0 "${OldPid}" 2>/dev/null ) && {
					print -r -- "${OldPid}"
					return 0
				}
			}

			local BridgeURL="http://${ServerArgs[HostAddress]:-127.0.0.1}:${ServerArgs[Port]:-3000}"
			local RingFile="${WebAPIPaths[EventsFile]}"
			local CursorFile="${WebAPIPaths[EventsCursor]}"
			local SizeFile="${WebAPIPaths[EventsSize]}"
			local PausedFile="${WebAPIPaths[EventsPaused]}"

			(
				local EventName="" DataLine="" Line=""
				curl -sSN "${BridgeURL}/bridge/events" | while IFS= read -r Line; do
					Line="${Line%$'\r'}"
					[[ "${Line}" == event:* ]] && {
						EventName="${Line#event: }"
						continue
					}
					[[ "${Line}" == data:* ]] && {
						DataLine="${Line#data: }"
						continue
					}
					[[ -z "${Line}" && -n "${DataLine}" ]] && {
						[[ -f "${PausedFile}" ]] || {
							local -i MaxSz=100
							[[ -f "${SizeFile}" ]] && {
								local RawSz="$(<"${SizeFile}")"
								[[ "${RawSz}" == <-> ]] && (( RawSz > 0 )) && MaxSz=${RawSz}
							}
							print -r -- "{\"event\":\"${EventName:-message}\",\"data\":${DataLine}}" >> "${RingFile}"
							local -a AllLines=( "${(@f)$(<"${RingFile}")}" )
							(( ${#AllLines} > MaxSz )) && {
								local -i Drop=$(( ${#AllLines} - MaxSz ))
								print -rl -- "${(@)AllLines[$(( Drop + 1 )),-1]}" >| "${RingFile}"
								[[ -f "${CursorFile}" ]] && {
									local -i Cur="$(<"${CursorFile}")"
									Cur=$(( Cur - Drop ))
									(( Cur < 1 )) && Cur=1
									print -r -- "${Cur}" >| "${CursorFile}"
								}
							}
						}
						EventName=""
						DataLine=""
					}
				done
			) >/dev/null 2>&1 &
			local BgPid=$!
			print -r -- "${BgPid}" >| "${WebAPIPaths[EventsPid]}"
			print -r -- "${BgPid}"
		}

		function __@webAPI:events:stop {
			[[ -f "${WebAPIPaths[EventsPid]}" ]] || return 1
			local BgPid="$(<"${WebAPIPaths[EventsPid]}")"
			[[ -n "${BgPid}" ]] && ( kill -0 "${BgPid}" 2>/dev/null ) && kill -TERM "${BgPid}"
			rm -f "${WebAPIPaths[EventsPid]}"
			print -r -- "Stopped"
		}

		local -a EventCommandNames=( Read QueueSize Clear Pause Resume Start Stop )
		local -a EventCommandSpecs=( Read Queue.Size Clear Pause Resume Start Stop )
		set -- "${(@)argv}"
		@args:parse "${(@)EventCommandSpecs}"

		local -i ExitCode=0 Dispatched=0
		local S
		for S ( ${EventCommandNames} ) {
			local Vals=( ${(P)S} )
			(( ${#Vals[1]/0/} )) && {
				Dispatched=1
				"__@webAPI:events:${(L)S}" "${(@)Argv}" || ExitCode=$?
			}
		}

		(( Dispatched )) || {
			__@webAPI:events:read || ExitCode=$?
		}
		return ${ExitCode}
	} always {
		unfunction \
			__@webAPI:events:maxSize \
			__@webAPI:events:queuesize \
			__@webAPI:events:read \
			__@webAPI:events:clear \
			__@webAPI:events:pause \
			__@webAPI:events:resume \
			__@webAPI:events:start \
			__@webAPI:events:stop \
			2>/dev/null
	}
}

[[ "${ZSH_EVAL_CONTEXT}" == *:file* ]] || @webAPI:events "${(@)argv}"
