#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent -o aliases

function __@webAPI:help {
	function __@webAPI:help:item {
		local spec="${1}" args="${2}" desc="${3}" examples="${4}"
		local pat
		pat="$(@args:parse:generatePattern "${spec}")"
		print -P -- "  %B${spec}%b${args:+ ${args}}"
		print -P -- "    %F{cyan}Pattern:%f     ${pat}"
		print -P -- "    %F{green}Description:%f ${desc}"
		print -P -- "    %F{yellow}Examples:%f    ${examples}"
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
