#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases

function __@webAPI:paths:resolve {
	local -a UserPathDirs=( "${(@M)path:#${HOME}/*}" )
	local -a UserFpathDirs=( "${(@M)fpath:#${HOME}/*}" )
	local DefaultBinDir="${XDG_BIN_HOME:-${UserPathDirs[1]:-${HOME}/.local/bin}}"
	local DefaultFuncDir="${UserFpathDirs[1]:-${XDG_DATA_HOME:-${HOME}/.local/share}/zsh/site-functions}"
	local DefaultDataDir="${XDG_DATA_HOME:-${${(s.:.)XDG_DATA_DIRS}[1]:-${HOME}/.local/share}}/webapi"
	local DefaultConfigDir="${XDG_CONFIG_HOME:-${${(s.:.)XDG_CONFIG_DIRS}[1]:-${HOME}/.config}}/webapi"
	local DefaultStateDir="${XDG_RUNTIME_DIR:-${XDG_STATE_HOME:-${HOME}/.local/state}}/webapi"
	local InstallConf="${DefaultConfigDir}/install.conf"

	local -A InstallConfigs=()
	[[ -f "${InstallConf}" ]] && {
		local -a InstallLines=("${$(<"${InstallConf}")//(#m)([[:space:]]#|)=([[:space:]]#|)/${MATCH// /}}")
		InstallLines=("${(@fZ.C.)InstallLines}")
		(( ${#${InstallLines:-}} )) && { InstallConfigs=("${(@s.=.)InstallLines}") }
	}

	WebAPIPaths=(
		RepoDir      "${InstallConfigs[RepoDir]}"
		BinDir       "${DefaultBinDir}"
		FuncDir      "${InstallConfigs[FuncDir]:-${DefaultFuncDir}}"
		DataDir      "${DefaultDataDir}"
		ConfigDir    "${DefaultConfigDir}"
		InstallConf  "${InstallConf}"
		StateDir     "${DefaultStateDir}"
		StateFile    "${DefaultStateDir}/server.state"
		TemplatesDir "${DefaultConfigDir}/templates"
		EventsFile   "${DefaultStateDir}/events.ring"
		EventsCursor "${DefaultStateDir}/events.cursor"
		EventsSize   "${DefaultStateDir}/events.size"
		EventsPid    "${DefaultStateDir}/events.pid"
		EventsPaused "${DefaultStateDir}/events.paused"
	)
}

function __@webAPI:config:resolve {
	local -a CliArgs=( "${(@)argv}" )
	local -a ConfigSpecs=( HostAddr.ess:1 Port:1 Conf.ig.uration.File:1 )
	local -a ConfigDefaults=( 127.0.0.1 3000 webAPI.conf )

	set -- "${(@)${(@)ConfigSpecs//(#m)*/Default${MATCH//[.:+0-9]/}}:^ConfigDefaults}"
	@args:parse "${(@)ConfigSpecs//(#m)*/Default${MATCH}}"

	set -- "${(@)CliArgs}"
	@args:parse Conf.ig.uration.File:1
	local CfgFile="${ConfigurationFile[1]:-${WebAPIPaths[RepoDir]:-${PWD}}/${DefaultConfigurationFile[1]:-webAPI.conf}}"

	[[ -f "${CfgFile}" ]] && {
		local -a ConfigLines=("${$(<"${CfgFile}")//(#m)([[:space:]]#|)=([[:space:]]#|)/${MATCH// /}}")
		ConfigLines=("${(@fZ.C.)ConfigLines}")
		set -- "${(@)ConfigLines//(#m)*/File${MATCH}}"
		@args:parse "${(@)ConfigSpecs//(#m)*/File${MATCH}}"
	}

	set -- "${(@)CliArgs}"
	@args:parse "${(@)ConfigSpecs//(#m)*/${MATCH}}"
	RemainingArgv=( "${(@)Argv}" )

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
}
