#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases

(( ! ${+functions[__@args:parse]} )) && {
	local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
	. <(2>/dev/null curl -fsSL "${ArgParserURL}" --)
	. "${${(%):-%x}:A}" "${(@)argv}"
	return
}

function @webAPI:template {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases
	{
		local ScriptRoot="${${(%):-%x}:A:h:h:h:h}"
		[[ -f "${ScriptRoot}/@webAPI" ]] || ScriptRoot="${PWD}"
		(( ${+functions[__@webAPI:paths:resolve]} )) || . "${ScriptRoot}/@/webAPI/env/__@webAPI:env.zsh"

		(( ${#${(k)WebAPIPaths}} )) || {
			local -A WebAPIPaths=()
			__@webAPI:paths:resolve
		}

		function __@webAPI:template:new {
			local Name="${1}"
			[[ -n "${Name}" ]] || {
				print -u2 -- "Usage: @webAPI template new <name> [provider[:op]] [key=val...]"
				return 1
			}
			shift
			mkdir -p "${WebAPIPaths[TemplatesDir]}"
			local TplFile="${WebAPIPaths[TemplatesDir]}/${Name}.conf"
			local Target=""
			local -a Params=()
			local Arg
			for Arg ( "${(@)argv}" ) {
				[[ "${Arg}" == *"="* ]] && {
					Params+=( "${Arg}" )
				} || {
					[[ -z "${Target}" ]] && Target="${Arg}"
				}
			}
			{
				[[ -n "${Target}" ]] && print -r -- "Target=${Target}"
				for Arg ( "${(@)Params}" ) {
					print -r -- "${Arg}"
				}
			} > "${TplFile}"
			print -r -- "Saved template '${Name}' to ${TplFile}"
		}

		function __@webAPI:template:load {
			local Name="${1}"
			[[ -n "${Name}" ]] || {
				print -u2 -- "Usage: @webAPI template load <name> [key=val...]"
				return 1
			}
			shift
			local TplFile="${WebAPIPaths[TemplatesDir]}/${Name}.conf"
			[[ -f "${TplFile}" ]] || {
				print -u2 -- "Template '${Name}' not found at ${TplFile}"
				return 1
			}
			local -a Lines=( "${(@f)$(<"${TplFile}")}" )
			local Target=""
			local -a Params=()
			local Line
			for Line ( "${(@)Lines}" ) {
				[[ -z "${Line}" || "${Line}" == "#"* ]] && continue
				[[ "${Line}" == Target=* ]] && {
					Target="${Line#Target=}"
				} || {
					Params+=( "${Line}" )
				}
			}
			local Arg
			for Arg ( "${(@)argv}" ) {
				[[ "${Arg}" == *"="* ]] && Params+=( "${Arg}" )
			}

			local BridgeURL="http://${ServerArgs[HostAddress]:-127.0.0.1}:${ServerArgs[Port]:-3000}"
			local TargetProv="" TargetOp=""
			[[ -n "${Target}" ]] && {
				[[ "${Target}" == *":"* ]] && {
					TargetProv="${Target%%:*}"
					TargetOp="${Target#*:}"
				} || {
					TargetOp="${Target}"
				}
			}
			local ParamsJson
			(( ${+functions[__@webAPI:bridge:params]} )) && {
				ParamsJson="$(__@webAPI:bridge:params "${(@)Params}")"
			} || {
				local -a Pairs=()
				local Item K V
				for Item ( "${(@)Params}" ) {
					[[ "${Item}" == *"="* ]] && {
						K="${Item%%=*}"
						V="${Item#*=}"
						[[ "${V}" == (true|false|null|(-|)<->(.<->|)) ]] && {
							Pairs+=( "\"${K}\":${V}" )
						} || {
							Pairs+=( "\"${K}\":\"${V//\"/\\\"}\"" )
						}
					}
				}
				ParamsJson="{${(j.,.)Pairs}}"
			}
			local Payload="{\"action\":\"fill\",\"provider\":\"${TargetProv}\",\"operation\":\"${TargetOp}\",\"params\":${ParamsJson}}"
			curl -fsSL -X POST -H "Content-Type: application/json" -d "${Payload}" "${BridgeURL}/bridge/command"
			print ""
		}

		function __@webAPI:template:edit {
			local Name="${1}"
			[[ -n "${Name}" ]] || {
				print -u2 -- "Usage: @webAPI template edit <name> [key=val...]"
				return 1
			}
			shift
			local TplFile="${WebAPIPaths[TemplatesDir]}/${Name}.conf"
			[[ -f "${TplFile}" ]] || {
				print -u2 -- "Template '${Name}' not found at ${TplFile}"
				return 1
			}
			(( ARGC )) && {
				local -A TplMap=()
				local -a Order=()
				local Line K
				for Line ( "${(@f)$(<"${TplFile}")}" ) {
					[[ "${Line}" == *"="* ]] && {
						K="${Line%%=*}"
						(( ${+TplMap[$K]} )) || Order+=( "${K}" )
						TplMap[$K]="${Line#*=}"
					}
				}
				local Arg
				for Arg ( "${(@)argv}" ) {
					[[ "${Arg}" == *"="* ]] && {
						K="${Arg%%=*}"
						(( ${+TplMap[$K]} )) || Order+=( "${K}" )
						TplMap[$K]="${Arg#*=}"
					} || {
						(( ${+TplMap[Target]} )) || Order=( Target "${(@)Order}" )
						TplMap[Target]="${Arg}"
					}
				}
				{
					for K ( "${(@)Order}" ) {
						print -r -- "${K}=${TplMap[$K]}"
					}
				} > "${TplFile}"
				print -r -- "Updated template '${Name}'"
			} || {
				${EDITOR:-vi} "${TplFile}"
			}
		}

		function __@webAPI:template:remove {
			local Name="${1}"
			[[ -n "${Name}" ]] || {
				print -u2 -- "Usage: @webAPI template remove <name>"
				return 1
			}
			local TplFile="${WebAPIPaths[TemplatesDir]}/${Name}.conf"
			[[ -f "${TplFile}" ]] || {
				print -u2 -- "Template '${Name}' not found at ${TplFile}"
				return 1
			}
			rm -f "${TplFile}"
			print -r -- "Removed template '${Name}'"
		}

		function __@webAPI:template:list {
			[[ -d "${WebAPIPaths[TemplatesDir]}" ]] || return 0
			local -a Files=( "${WebAPIPaths[TemplatesDir]}"/*.conf(N) )
			local F
			for F ( "${(@)Files}" ) {
				print -r -- "${F:t:r}"
			}
		}

		local -a TplCommandNames=( New Load Edit Remove List )
		local -a TplCommandSpecs=( New Load Edit Remove List )
		set -- "${(@)argv}"
		@args:parse "${(@)TplCommandSpecs}"

		local -i ExitCode=0 Dispatched=0
		local S
		for S ( ${TplCommandNames} ) {
			local Vals=( ${(P)S} )
			(( ${#Vals[1]/0/} )) && {
				Dispatched=1
				"__@webAPI:template:${(L)S}" "${(@)Argv}" || ExitCode=$?
			}
		}

		(( Dispatched )) || {
			__@webAPI:template:list || ExitCode=$?
		}
		return ${ExitCode}
	} always {
		unfunction \
			__@webAPI:template:new \
			__@webAPI:template:load \
			__@webAPI:template:edit \
			__@webAPI:template:remove \
			__@webAPI:template:list \
			2>/dev/null
	}
}

[[ "${ZSH_EVAL_CONTEXT}" == *:file* ]] || @webAPI:template "${(@)argv}"
