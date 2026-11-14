#!/usr/bin/env zsh

() {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops
	(( ${+functions[__@args:parse]} )) && return 0
	local ArgParserURL='https://raw.githubusercontent.com/ES-SR/ZshTools/refs/heads/main/%40/args/%40args%3Aparse.zsh'
	. <(2>/dev/null curl -fsSL "${ArgParserURL}" --)
}

() {
	emulate -LR zsh -o extendedglob -o typesetsilent -o shortloops -o aliases
	{
		function __@webAPI:install:help {
			<<-"@webAPI:install.EOF"
				Usage: install.zsh [Options]

				Installs the WebAPI repository, copies the standalone '@webAPI' CLI function
				and '_@webAPI' completion function into your Zsh $fpath (asking via vared),
				and optionally configures autoloading in your .zshrc.

				Options (case-insensitive, supports --flag, -short, or flag=value):
				  -h,  --help                  Show this help message
				  -u,  --update                Pull latest changes if repository already exists
				  -r,  --run                   Start the server via '@webAPI server run' after installing
				  -d,  --directory <path>      Target directory for the WebAPI repository
				  -fd, --func-directory <path> Target $fpath directory for '@webAPI' and '_@webAPI'
			@webAPI:install.EOF
		}

		@args:parse \
			Help \
			Update \
			Run \
			Dir.ectory:1 \
			FuncDir.ectory:1

		set -- "${(@)Argv}"

		(( Help )) && {
			__@webAPI:install:help
			return 0
		}

		local -a UserFpathDirs=( "${(@M)fpath:#${HOME}/*}" )
		local DefaultFuncDir="${UserFpathDirs[1]:-${XDG_DATA_HOME:-${HOME}/.local/share}/zsh/site-functions}"
		local DefaultConfigDir="${XDG_CONFIG_HOME:-${${(s.:.)XDG_CONFIG_DIRS}[1]:-${HOME}/.config}}/webapi"
		local InstallConf="${DefaultConfigDir}/install.conf"

		local RepoDir="" FuncDir="${DefaultFuncDir}"
		[[ -f "${InstallConf}" ]] && {
			. <(print -rl -- "${(@)${(@f)$(<"${InstallConf}")}//[[:space:]]/}")
		}

		local RepoTarget="${Directory[1]:-${RepoDir:-${PWD}/WebAPI}}"
		[[ -f "${PWD}/server.ts" && -d "${PWD}/.git" ]] && {
			RepoTarget="${PWD}"
		}

		[[ -t 0 ]] && {
			vared -p "Repository directory: " -c RepoTarget
		}
		[[ -n "${RepoTarget}" ]] || return 1

		local WebAPIRepoURL='https://github.com/ES-SR/WebAPI.git'
		[[ "${PWD:t}" == "${RepoTarget:t}" && -d .git ]] && {
			(( Update )) && git pull --ff-only
			RepoDir="${PWD}"
		} || [[ -d "${RepoTarget}/.git" ]] && {
			cd "${RepoTarget}" || return 1
			(( Update )) && git pull --ff-only
			RepoDir="${PWD}"
		} || {
			git clone "${WebAPIRepoURL}" "${RepoTarget}" && cd "${RepoTarget}" || return 1
			RepoDir="${PWD}"
		}

		local TargetFuncDir="${FuncDirectory[1]:-${FuncDir}}"
		[[ -t 0 ]] && {
			vared -p "Directory to install '@webAPI' and '_@webAPI' functions (leave empty to skip): " -c TargetFuncDir
		}

		[[ -n "${TargetFuncDir}" ]] && {
			mkdir -p "${TargetFuncDir}" "${DefaultConfigDir}"
			cp -f "${RepoDir}/@webAPI" "${TargetFuncDir}/@webAPI"
			cp -f "${RepoDir}/_@webAPI" "${TargetFuncDir}/_@webAPI"
			chmod +x "${TargetFuncDir}/@webAPI"

			cat > "${InstallConf}" <<-EOF
				RepoDir = ${RepoDir}
				FuncDir = ${TargetFuncDir}
			EOF

			print "Installed '@webAPI' and '_@webAPI' into ${TargetFuncDir}"

			local AddFpath="yes"
			[[ -t 0 ]] && {
				vared -p "Add ${TargetFuncDir} to \$fpath and autoload @webAPI? [yes/no]: " -c AddFpath
			}

			[[ "${AddFpath}" == (#i)y(es|) ]] && {
				(( ! ${fpath[(Ie)${TargetFuncDir}]} )) && {
					fpath=( "${TargetFuncDir}" "${(@)fpath}" )
				}
				autoload -z @webAPI _@webAPI
				(( ${+functions[compdef]} )) && compdef _@webAPI @webAPI

				local ZshRcFile="${ZDOTDIR:-${HOME}}/.zshrc"
				[[ -t 0 ]] && {
					vared -p "Zsh startup file to persist fpath & autoload (leave empty to skip): " -c ZshRcFile
				}

				[[ -n "${ZshRcFile}" ]] && {
					[[ ! -f "${ZshRcFile}" || "$(<"${ZshRcFile}")" != *"autoload -z @webAPI"* ]] && {
						cat >> "${ZshRcFile}" <<-EOF

							# @webAPI CLI & completion
							(( \${fpath[(Ie)${TargetFuncDir}]} )) || fpath=( "${TargetFuncDir}" "\${(@)fpath}" )
							autoload -z @webAPI _@webAPI
							(( \${+functions[compdef]} )) && compdef _@webAPI @webAPI
						EOF
						print "Added fpath & autoload configuration to ${ZshRcFile}"
					} || {
						print "${ZshRcFile} already contains @webAPI autoload configuration."
					}
				}
			}
		}

		(( Run )) && {
			. "${RepoDir}/@webAPI" server run
		}
	} always {
		unfunction __@webAPI:install:help 2>/dev/null
	}
} "${(@)argv}"
