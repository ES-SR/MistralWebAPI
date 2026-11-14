#!/usr/bin/env zsh
#autoload
emulate -LR zsh -o extendedglob -o typesetsilent

function __@webAPI:update {
	local RepoTarget="${Directory[1]:-${WebAPIPaths[RepoDir]:-WebAPI}}"
	__@webAPI:repo:ensure "${RepoTarget}"
}
