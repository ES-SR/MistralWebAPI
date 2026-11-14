#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent

function @webAPI:json:parse {
	emulate -LR zsh -o extendedglob -o typesetsilent
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
