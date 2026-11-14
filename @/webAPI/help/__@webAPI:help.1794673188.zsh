#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent -o aliases

function __@webAPI:help {
	function __@webAPI:help:item {
		local Spec="${1}" Args="${2}" Desc="${3}" Examples="${4}"
		local Pat
		Pat="$(@args:parse:generatePattern "${Spec}")"
		print -P -- "  %B${Spec}%b${Args:+ ${Args}}"
		print -P -- "    %F{cyan}Pattern:%f     ${Pat}"
		print -P -- "    %F{green}Description:%f ${Desc}"
		print -P -- "    %F{yellow}Examples:%f    ${Examples}"
		print ""
	}

	print -P -- "%BUsage:%b @webAPI [Command | Template | Form Values] [Options]"
	print ""
	local -i Idx=1
	local S Pat
	for S ( ${SpecNames} ) {
		Pat="${SpecPatterns[Idx++]}"
		[[ "$S" == "Help" ]] && print -P -- "%BCommands & Subtools:%b"
		[[ "$S" == "HostAddress" ]] && print -P -- "%BConfiguration Options:%b"
		__@webAPI:help:item "${Pat}" "${(@s.;.)HelpInfo[$S]}"
	}

	unfunction __@webAPI:help:item 2>/dev/null
}
