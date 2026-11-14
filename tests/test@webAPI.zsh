#!/usr/bin/env zsh
emulate -LR zsh -o extendedglob -o typesetsilent -o aliases
setopt aliases

function @print:pel {
	emulate -L zsh; options[extendedglob]=on

	local -a Args=(${argv})

	local -i LJustify=${Args[(i)(#s)[0-9]#(#e)]}
	local -i RJustify=${Args[(I)(#s)[0-9]#(#e)]}
	(( LJustify == RJustify )) && {
		(( ARGC / 2.0 < LJustify )) && {
			(( LJustify = 0 ))
			RJustify=$Args[$RJustify]
			Args=(${Args:#$RJustify})
		} || {
			(( RJustify = 0 ))
			LJustify=$Args[$LJustify]
			Args=(${Args:#$LJustify})
		}
	} || {
		RJustify=${${Args[$RJustify]}:-0}
		LJustify=${${Args[$LJustify]}:-0}
		Args=(${Args:#$LJustify})
		Args=(${Args:#$RJustify})
	}
	local -i LJ=${LJustify}
	local -i RJ=${RJustify}
	(( LJ + RJ )) || {
		(( LJ = 1 , RJ = 1 ))
	}
	(( LJ = LJ * COLUMNS / ( LJ + RJ ) ))
	(( RJ = COLUMNS - LJ ))

	local LMargin=${Args[(r)(#s)[^[:alnum:]]#(#e)]}
	local RMargin=${Args[(R)(#s)[^[:alnum:]]#(#e)]}
	(( ${(c)#LMargin} + ${(c)#RMargin} )) && {
		Args=(${Args:#$LMargin})
		Args=(${Args:#$RMargin})
	}

	local LPadding=${Args[(r)(#s)[^[:alnum:]]#(#e)]}
	local RPadding=${Args[(R)(#s)[^[:alnum:]]#(#e)]}
	(( ${(c)#LPadding} + ${(c)#RPadding} )) && {
		Args=(${Args:#$LPadding})
		Args=(${Args:#$RPadding})
	}

	local Content LP RP LM RM
	(( $#Args )) && {
		LP=${LPadding:-" "}
		RP=${RPadding:-" "}
		LM=${LMargin:-"-"}
		RM=${RMargin:-"-"}

		Content=${Args}
		Args=()
	} || {
		LM=${LMargin}
		RM=${RMargin}
		LP=${LPadding:-$LM}
		RP=${RPadding:-$RM}
		Content="${LP}${RP}"
		(( ${(c)#Content} )) || {
			print -- ${(l.((COLUMNS))..-.)}
			return
		}
	}

	print -P -- ${(pel.((LJ))..$LM..$LP.r.((RJ))..$RM..$RP.)Content}
}

# Ensure __@args:parse exists in current shell
(( ${+functions[__@args:parse]} )) || {
	function __@args:parse {
		emulate -LR zsh -o extendedglob -o typesetsilent
		{
			local -a Specs=("${(@)argv[2,-1]}") FlagNames FlagMaxExtracts FlagPatterns
			local Spec
			for Spec ("${(@)Specs}") {
				local -a SpecParts=("${(@s.:.)Spec}")

				local MaxExtracts="${${(M)Spec%:${~:-"(+|<->)"}}#:}"
				SpecParts=(${SpecParts:#$MaxExtracts})
				MaxExtracts=${MaxExtracts:-0}

				local Name=${SpecParts[-1]}
				SpecParts[-1]=()

				local Pattern=${${(j.:.)SpecParts}:-$(@args:parse:generatePattern "${Name}")}

				Name="${${${${${Name//,*\//}//\/*./}//[.\/]/}//[^-[:alnum:]]/}//-/_}"

				FlagNames+=("${Name}")
				FlagPatterns+=("${Pattern}")
				FlagMaxExtracts+=(${MaxExtracts})

				local -a "${Name}"
				(( ${MaxExtracts/+/1} )) || {
					set -A "${Name}" 0
				}
			}

			set -- "${(@P)1}"

			local MetaPat="${(j.|.)FlagPatterns}"

			local -i Idx
			local -a Argv FlagInfo=(${"${(@)FlagInfo}":-})
			while (( ${Idx::=${argv[(I)${~MetaPat}]}} )) {
				argv[$Idx]=("${${argv[$Idx]}%%=*}" ${"${${(M)${argv[$Idx]}%%=*}#=}":-})
				local RawFlag="${argv[$Idx]}"
				local FNIdx=${FlagPatterns//(#m)*/${${${RawFlag}[(r)${~MATCH},(R)${~MATCH}]}:+${FlagPatterns[(ie)$MATCH]}}}
				local FlagName="${FlagNames[$FNIdx]}"
				local MaxExtract="${${FlagMaxExtracts[$FNIdx]}/+/${ARGC}}"
				set -A FlagInfo "${FlagName}:${Idx}:${RawFlag}" "${(@)FlagInfo}"
				set -A "${FlagName}" "${(@)argv[$((Idx+1)),$((Idx + MaxExtract))]}" "${(@P)FlagName}"
				(( MaxExtract )) || {
					set -A "${FlagName}" $(( "${(P)FlagName:-0}" + 1 ))
				}
				set -A Argv "${(@)argv[$((Idx+1+MaxExtract)),-1]}" "${(@)Argv}"
				argv[$Idx,-1]=()
			}

			set -A Argv "${(@)argv}" "${(@)Argv}"

			local FN
			for FN ($FlagNames Argv FlagInfo) {
				typeset -p1 -- ${FN}
			}
		}
	}

	function __@args:parse:bridge {
		print -r -- 'eval "$(__@args:parse __ArgsParseArgv "${(@)argv}")"'
	}

	alias @args:parse='local -a __ArgsParseArgv=("${(@)argv}"); . <(__@args:parse:bridge)'

	function @args:parse:generatePattern {
		emulate -LR zsh -o extendedglob -o typesetsilent

		(( ARGC )) || return 1
		(( ARGC == 1 )) && [[ $1 = (-|--)(#i)(h(elp|)) ]] && {
			<<-"EOF"
				. the following segment is optional
				, the following preceding segment is an alternate
				/ the following segment is applied to the end of each preceding segment
			EOF
			return
		}

		local Arg
		for Arg {
			# 1. Normalize camelCase into required word boundaries (FileDest -> File-Dest)
			local SpecNorm="${Arg//(#b)([a-z0-9])((.|)[A-Z])/$match[1]-$match[2]}"

			# 2. Split into required words on '-'
			local -a Words=(${(s.-.)SpecNorm})
			local -a LongWordPats=()
			local -a ShortChars=()

			local Word
			for Word ( "${(@)Words}" ) {
				# Short flag anchor: first letter of required word stem
				ShortChars+=( "${${Word/[^[:alnum:]]/}[1]}" )

				# Split word into optional segments on '.'
				local -a Segs=( ${(s:.:)Word} )
				local -a Stems=() Slashes=() Alts=()

				# Parse individual segment DSL structures
				local Seg
				for Seg ( "${(@)Segs}" ) {
					if [[ "$Seg" = *","* ]] {
						# Handle Stem,Alt1/Alt2 syntax (e.g., ector,y/ies)
						local Stem="${Seg%%,*}"
						local Rest="${Seg#*,}"
						local -a AltList=(${(s./.)Rest})
						Stems+=("${Stem}")
						Slashes+=("")
						Alts+=("${(j.|.)AltList}")
					} elif [[ "${Seg}" = *"/"* ]] {
						# Handle Stem/Slash syntax (e.g., Dir/s)
						Stems+=("${Seg%%/*}")
						Slashes+=("${Seg#*/}")
						Alts+=("")
					} else {
						Stems+=("${Seg}")
						Slashes+=("")
						Alts+=("")
					}
				}

				# Pass 1: Backward propagation of slashes to preceding segments
				local CurrSlash=""
				local -i I
				for (( I=${#Segs}; I>=1; I-- )) {
					if [[ -n "${Slashes[$I]}" ]] {
						CurrSlash="${Slashes[$I]}"
					} elif [[ -n "${Alts[$I]}" ]] {
						CurrSlash=""
					} else {
						Slashes[$I]="${CurrSlash}"
					}
				}

				# Pass 2: Right-to-left nested group pattern assembly
				local WordPat=""
				for (( I=${#Segs}; I>=1; I-- )) {
					local Stem="${Stems[$I]}"
					local Slash="${Slashes[$I]}"
					local Alt="${Alts[$I]}"

					local SegPat="${Stem}"
					[[ -n "${Alt}" ]] && { SegPat="${Stem}(${Alt})" }

					if (( I == ${#Segs} )) {
						if [[ -n "${Alt}" ]] {
							WordPat="${SegPat}"
						} elif [[ -n "${Slash}" ]] {
							WordPat="${Stem}(${Slash}|)"
						} else {
							WordPat="${SegPat}"
						}
					} else {
						WordPat="${SegPat}(${Slash:+${Slash}|}${WordPat}|)"
					}
				}

				if [[ "${Word[1]}" = "." ]] {
					WordPat="(${WordPat}|)"
				}

				LongWordPats+=("${WordPat}")
			}

			# 3. Combine long forms and short forms
			local PartJoint="([-_.]|)"
			local LongPattern="${(pj.$PartJoint.)LongWordPats}"
			local ShortPattern="${(pj.$PartJoint.)ShortChars}"

			local FullPattern=""
			[[ "${LongPattern}" = "${ShortPattern}" ]] && {
				FullPattern="(-|--)${LongPattern}"
			} || {
				FullPattern="((-|--|)${LongPattern})|((-|--)${ShortPattern})"
			}

			# Wrap in Zsh string anchors, case insensitivity, and optional assignment matching
			print -r -- "(#s)(#i)(${FullPattern})(=*|)(#e)"
		}
	}
}

() {
	emulate -LR zsh -o extendedglob -o typesetsilent -o aliases
	setopt aliases

	local ScriptFile="${(%):-%x}"
	local ScriptDir="${ScriptFile:A:h}"
	local RepoDir="${ScriptDir:h}"
	local WebAPIBin="${RepoDir}/@webAPI"
	[[ -f "${WebAPIBin}" ]] || WebAPIBin="${PWD}/@webAPI"

	local -i PassCount=0
	local -i FailCount=0

	function test@assert:equal {
		local TestName="${1}"
		local Got="${2}"
		local Expected="${3}"
		[[ "$Got" == "$Expected" ]] && {
			(( PassCount++ ))
			print -P -- "%F{green}  [PASS]%f ${TestName}"
		} || {
			(( FailCount++ ))
			print -P -- "%F{red}  [FAIL]%f ${TestName}"
			print -P -- "         Expected: %F{yellow}${Expected}%f"
			print -P -- "         Got:      %F{red}${Got}%f"
		}
	}

	function test@assert:true {
		local TestName="${1}"
		local Val="${2}"
		(( Val )) && {
			(( FailCount++ ))
			print -P -- "%F{red}  [FAIL]%f ${TestName} (exit status: ${Val})"
		} || {
			(( PassCount++ ))
			print -P -- "%F{green}  [PASS]%f ${TestName}"
		}
	}

	# The 3-tier config parsing function mirroring @webAPI & user specification
	function test@parse:configHierarchy {
		emulate -LR zsh -o extendedglob -o typesetsilent -o aliases
		setopt aliases
		local ConfPath="${1}"
		shift
		local -a CliArgs=( "${(@)argv}" )

		local -a ConfigSpecs=( HostAddr.ess:1 Port:1 Conf.ig.uration.File:1 )
		local -a ConfigDefaults=( 127.0.0.1 3000 webAPI.conf )

		set -- "${(@)${(@)ConfigSpecs//(#m)*/Default${MATCH//[.:+0-9]/}}:^ConfigDefaults}"
		@args:parse "${(@)ConfigSpecs//(#m)*/Default${MATCH}}"

		[[ -n "${ConfPath}" && -f "${ConfPath}" ]] && {
			local -a ConfigLines=("${$(<"${ConfPath}")//(#m)([[:space:]]#|)=([[:space:]]#|)/${MATCH// /}}")
			ConfigLines=("${(@fZ.C.)ConfigLines}")
			set -- "${(@)ConfigLines//(#m)*/File${MATCH}}"
			@args:parse "${(@)ConfigSpecs//(#m)*/File${MATCH}}"
		}

		set -- "${(@)CliArgs}"
		@args:parse "${(@)ConfigSpecs//(#m)*/${MATCH}}"

		local -A ServerArgs=()
		local S
		for S ( ${ConfigSpecs} ) {
			S="${S//[.:0-9]/}"
			local CliArg="${${(P)S}[1]}"
			local FileArg="File${S}"
			local FileArg="${${(P)FileArg}[1]}"
			local DefaultArg="Default${S}"
			local DefaultArg="${${(P)DefaultArg}[1]}"
			ServerArgs[$S]="${CliArg:-${FileArg:-${DefaultArg}}}"
		}

		print -r -- "${ServerArgs[HostAddress]}|${ServerArgs[Port]}|${ServerArgs[ConfigurationFile]}"
	}

	# Use XDG runtime directory with safe fallback per convention
	local TestBaseDir="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}"
	local TestTmpDir="${TestBaseDir}/webapi-test-${$}-${RANDOM}"
	mkdir -p "${TestTmpDir}"

	{
		@print:pel "Section 1: User Reference Pass Cases (Defaults -> File -> CLI)"

		# Test 1.1: Defaults only
		local Res="$(test@parse:configHierarchy "")"
		test@assert:equal "Defaults only: HostAddress" "${Res[(ws:|:)1]}" "127.0.0.1"
		test@assert:equal "Defaults only: Port" "${Res[(ws:|:)2]}" "3000"
		test@assert:equal "Defaults only: ConfigurationFile" "${Res[(ws:|:)3]}" "webAPI.conf"

		# Test 1.2: Config file values loaded (matching prompt 4196)
		local TestConf="${TestTmpDir}/Test.conf"
		cat > "$TestConf" <<-EOF
			# a comment
			Port=5200
			# an empty value
			HostAddress=192.168.1.100
			Other = spaceAroundEquals #trailing comment
		EOF
		Res="$(test@parse:configHierarchy "$TestConf")"
		test@assert:equal "Config file: HostAddress loaded" "${Res[(ws:|:)1]}" "192.168.1.100"
		test@assert:equal "Config file: Port loaded" "${Res[(ws:|:)2]}" "5200"

		# Test 1.3: User prompt test case: -p 4444 hostAddr=10.0.0.1 overrides config file
		Res="$(test@parse:configHierarchy "$TestConf" -p 4444 hostAddr=10.0.0.1)"
		test@assert:equal "User Case: HostAddress overridden by hostAddr=" "${Res[(ws:|:)1]}" "10.0.0.1"
		test@assert:equal "User Case: Port overridden by -p 4444" "${Res[(ws:|:)2]}" "4444"
		test@assert:equal "User Case: ConfigurationFile default preserved" "${Res[(ws:|:)3]}" "webAPI.conf"

		# Test 1.4: Partial override: CLI -p 8888 only, Host from config file
		Res="$(test@parse:configHierarchy "$TestConf" -p 8888)"
		test@assert:equal "Partial override: Host from config file" "${Res[(ws:|:)1]}" "192.168.1.100"
		test@assert:equal "Partial override: Port from CLI" "${Res[(ws:|:)2]}" "8888"

		# Test 1.5: Partial override: CLI -ha 10.0.0.9 only, Port from config file
		Res="$(test@parse:configHierarchy "$TestConf" -ha 10.0.0.9)"
		test@assert:equal "Partial override: Host from CLI" "${Res[(ws:|:)1]}" "10.0.0.9"
		test@assert:equal "Partial override: Port from config file" "${Res[(ws:|:)2]}" "5200"

		# Test 1.6: Empty config file falls back to defaults
		local EmptyConf="${TestTmpDir}/empty.conf"
		</dev/null >| "$EmptyConf"
		Res="$(test@parse:configHierarchy "$EmptyConf")"
		test@assert:equal "Empty config file: Host default" "${Res[(ws:|:)1]}" "127.0.0.1"
		test@assert:equal "Empty config file: Port default" "${Res[(ws:|:)2]}" "3000"

		# Test 1.7: Config file with empty value Host= falls back to default
		local EmptyValConf="${TestTmpDir}/empty_val.conf"
		cat > "$EmptyValConf" <<-EOF
			# comment
			Port=6100
			Host=
		EOF
		Res="$(test@parse:configHierarchy "$EmptyValConf")"
		test@assert:equal "Empty val Host=: fallback to default" "${Res[(ws:|:)1]}" "127.0.0.1"
		test@assert:equal "Empty val Host=: Port takes file value" "${Res[(ws:|:)2]}" "6100"

		@print:pel "Section 2: @args:parse DSL Pattern Verification"

		local -a Specs=(
			Help ServerRun ServerStop HostAddr.ess Port Conf.ig.uration.File
			Info Op.eration Fill Send Resp.onse Listen Extract.Keys
		)
		local Spec Pat
		for Spec ( "${Specs[@]}" ) {
			Pat="$(@args:parse:generatePattern "$Spec")"
			[[ -n "$Pat" ]]
			test@assert:true "Pattern generated for $Spec" $?
		}

		# Test CLI flag variations for HostAddr.ess
		Res="$(test@parse:configHierarchy "" -ha 10.0.0.4)"
		test@assert:equal "Flag -ha: HostAddress" "${Res[(ws:|:)1]}" "10.0.0.4"

		Res="$(test@parse:configHierarchy "" --host-addr 10.0.0.5)"
		test@assert:equal "Flag --host-addr: HostAddress" "${Res[(ws:|:)1]}" "10.0.0.5"

		Res="$(test@parse:configHierarchy "" --host-address 10.0.0.6)"
		test@assert:equal "Flag --host-address: HostAddress" "${Res[(ws:|:)1]}" "10.0.0.6"

		Res="$(test@parse:configHierarchy "" HostAddress=10.0.0.7)"
		test@assert:equal "Assignment HostAddress=: HostAddress" "${Res[(ws:|:)1]}" "10.0.0.7"

		Res="$(test@parse:configHierarchy "" hostAddr=10.0.0.8)"
		test@assert:equal "Assignment hostAddr=: HostAddress" "${Res[(ws:|:)1]}" "10.0.0.8"

		# Test CLI flag variations for Port
		Res="$(test@parse:configHierarchy "" -p 9001)"
		test@assert:equal "Flag -p: Port" "${Res[(ws:|:)2]}" "9001"

		Res="$(test@parse:configHierarchy "" --port 9002)"
		test@assert:equal "Flag --port: Port" "${Res[(ws:|:)2]}" "9002"

		Res="$(test@parse:configHierarchy "" Port=9003)"
		test@assert:equal "Assignment Port=: Port" "${Res[(ws:|:)2]}" "9003"

		# Test CLI flag variations for Conf.ig.uration.File
		Res="$(test@parse:configHierarchy "" -cf custom.conf)"
		test@assert:equal "Flag -cf: ConfigurationFile" "${Res[(ws:|:)3]}" "custom.conf"

		Res="$(test@parse:configHierarchy "" --configuration-file other.conf)"
		test@assert:equal "Flag --configuration-file: ConfigurationFile" "${Res[(ws:|:)3]}" "other.conf"

		@print:pel "Section 3: Runtime State File Isolation (__@webAPI:state:read)"

		local StateDir="${TestTmpDir}/state/webapi"
		mkdir -p "$StateDir"
		local StateFile="${StateDir}/server.state"
		cat > "$StateFile" <<-EOF
			Pid = 54321
			HostAddress = 10.10.10.10
			Port = 7777
			RepoDir = ${TestTmpDir}/mock_repo
		EOF

		local -A WebAPIPaths=( StateFile "$StateFile" )
		local -A ServerState=()

		function test@state:read {
			[[ -f "${WebAPIPaths[StateFile]}" ]] || return 1
			local -a StateLines=("${$(<"${WebAPIPaths[StateFile]}")//(#m)([[:space:]]#|)=([[:space:]]#|)/${MATCH// /}}")
			StateLines=("${(@fZ.C.)StateLines}")
			(( ${#${StateLines:-}} )) || return 1
			ServerState=("${(@s.=.)StateLines}")
		}

		test@state:read
		test@assert:true "state:read success" $?
		test@assert:equal "ServerState[Pid]" "${ServerState[Pid]}" "54321"
		test@assert:equal "ServerState[HostAddress]" "${ServerState[HostAddress]}" "10.10.10.10"
		test@assert:equal "ServerState[Port]" "${ServerState[Port]}" "7777"
		test@assert:equal "ServerState[RepoDir]" "${ServerState[RepoDir]}" "${TestTmpDir}/mock_repo"

		# Verify ServerArgs is unaffected by state read
		local -A ServerArgs=( HostAddress "127.0.0.1" Port "3000" )
		test@state:read
		test@assert:equal "Isolation: ServerArgs[HostAddress] unaffected" "${ServerArgs[HostAddress]}" "127.0.0.1"
		test@assert:equal "Isolation: ServerArgs[Port] unaffected" "${ServerArgs[Port]}" "3000"

		# Missing state file returns 1
		WebAPIPaths[StateFile]="${TestTmpDir}/missing.state"
		ServerState=()
		test@state:read
		test@assert:equal "Missing state file returns 1" "$?" "1"

		# Empty state file returns 1
		local EmptyState="${TestTmpDir}/empty.state"
		</dev/null >| "$EmptyState"
		WebAPIPaths[StateFile]="$EmptyState"
		ServerState=()
		test@state:read
		test@assert:equal "Empty state file returns 1" "$?" "1"

		@print:pel "Section 4: End-to-End @webAPI Binary Tests"

		# Test Server Configure: CLI flag resolution into ServerArgs
		local CfgOut
		CfgOut="$(zsh "${WebAPIBin}" Server Configure -ha 10.0.0.1 -p 8888 2>/dev/null)"
		local HasHA=1 HasP=1
		[[ "$CfgOut" == *"HostAddress=10.0.0.1"* ]] && HasHA=0
		[[ "$CfgOut" == *"Port=8888"* ]] && HasP=0
		test@assert:true "E2E: Server Configure -ha -p host" $HasHA
		test@assert:true "E2E: Server Configure -ha -p port" $HasP

		CfgOut="$(zsh "${WebAPIBin}" Server Configure hostAddr=10.0.0.2 -p 4444 2>/dev/null)"
		local HasHA2=1 HasP2=1
		[[ "$CfgOut" == *"HostAddress=10.0.0.2"* ]] && HasHA2=0
		[[ "$CfgOut" == *"Port=4444"* ]] && HasP2=0
		test@assert:true "E2E: Server Configure hostAddr= -p host" $HasHA2
		test@assert:true "E2E: Server Configure hostAddr= -p port" $HasP2

		# Test Server Configure reading a config file via -cf
		local E2EConf="${TestTmpDir}/e2e.conf"
		cat > "$E2EConf" <<-EOF
			HostAddress = 192.168.50.1
			Port = 3333
		EOF
		CfgOut="$(zsh "${WebAPIBin}" Server Configure -cf "$E2EConf" 2>/dev/null)"
		local HasCf=1 HasCfH=1 HasCfP=1
		[[ "$CfgOut" == *"e2e.conf"* ]] && HasCf=0
		[[ "$CfgOut" == *"HostAddress=192.168.50.1"* ]] && HasCfH=0
		[[ "$CfgOut" == *"Port=3333"* ]] && HasCfP=0
		test@assert:true "E2E: Server Configure -cf config file path" $HasCf
		test@assert:true "E2E: Server Configure -cf host from file" $HasCfH
		test@assert:true "E2E: Server Configure -cf port from file" $HasCfP

		# Test Server Status when stopped
		local StatusOut
		StatusOut="$(XDG_RUNTIME_DIR="${TestTmpDir}/runtime" zsh "${WebAPIBin}" Server Status 2>/dev/null)"
		local StatusExit=$?
		test@assert:equal "E2E: Server Status exit code when stopped" "$StatusExit" "1"
		test@assert:equal "E2E: Server Status prints Stopped" "$StatusOut" "Stopped"

		# Test Server Status when running with HostAddress
		local RunningStateDir="${TestTmpDir}/runtime_running/webapi"
		mkdir -p "${RunningStateDir}"
		cat > "${RunningStateDir}/server.state" <<-EOF
			Pid = $$
			HostAddress = 127.0.0.1
			Port = 3000
			RepoDir = ${TestTmpDir}
		EOF
		StatusOut="$(XDG_RUNTIME_DIR="${TestTmpDir}/runtime_running" zsh "${WebAPIBin}" Server Status 2>/dev/null)"
		StatusExit=$?
		test@assert:equal "E2E: Server Status exit code when running" "$StatusExit" "0"
		test@assert:equal "E2E: Server Status reports running with URL" "$StatusOut" "Running: PID=$$ URL=http://127.0.0.1:3000"

		# Test Help output contains generated patterns and examples
		local HelpOut
		HelpOut="$(zsh "${WebAPIBin}" Help 2>/dev/null)"
		local HasPat=1 HasEx=1
		[[ "$HelpOut" == *"Host([-_.]|)Addr"* ]] && HasPat=0
		[[ "$HelpOut" == *"Examples:"* ]] && HasEx=0
		test@assert:true "E2E: Help output includes generated patterns" $HasPat
		test@assert:true "E2E: Help output includes examples" $HasEx

		@print:pel "Test Summary"
		print -P -- "Passed: %F{green}${PassCount}%f"
		print -P -- "Failed: %F{red}${FailCount}%f"
		print -P -- "Total:  $(( PassCount + FailCount ))"

		(( FailCount > 0 )) && return 1 || return 0
	} always {
		rm -rf "${TestTmpDir}"
		unfunction \
			test@assert:equal \
			test@assert:true \
			test@parse:configHierarchy \
			test@state:read \
			2>/dev/null
	}
}
