#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
project_root=$PWD
source_tree=$(python3 scripts/prepare.py "$@")
required_node=$(tr -d '[:space:]' < "$source_tree/.nvmrc")
[[ $required_node =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Unexpected upstream Node version' >&2; exit 1; }
[[ $(uname -sm) == 'Linux x86_64' ]] || { echo 'Linux x64 is required' >&2; exit 1; }
if [[ $(node --version 2>/dev/null || true) != "v$required_node" ]]; then
	toolchain="$project_root/.work/toolchains/node-v$required_node-linux-x64"
	if [[ ! -x $toolchain/bin/node ]]; then
		mkdir -p "$project_root/.work/toolchains"
		archive="node-v$required_node-linux-x64.tar.xz"
		curl --fail --location --retry 3 "https://nodejs.org/dist/v$required_node/$archive" -o "$project_root/.work/toolchains/$archive"
		curl --fail --location --retry 3 "https://nodejs.org/dist/v$required_node/SHASUMS256.txt" -o "$project_root/.work/toolchains/SHASUMS256.txt"
		(cd .work/toolchains && rg "  $archive\$" SHASUMS256.txt | sha256sum --check --strict && tar -xf "$archive")
	fi
	export PATH="$toolchain/bin:$PATH"
fi
[[ $(node --version) == "v$required_node" ]] || exit 1
cd "$source_tree"
bash .personal-build/build.sh
if [[ ${CODE_PERSONAL_CONTAINER:-} == 1 ]]; then
	# A disposable container profile and virtual display; the installed app keeps normal sandbox defaults.
	dbus-run-session -- xvfb-run -a node .personal-build/smoke.mjs --ci
else
	node .personal-build/smoke.mjs
fi
node .personal-build/check-gallery.mjs
(cd .personal-build/arch && makepkg --cleanbuild --force)
node "$project_root/scripts/collect.mjs" "$source_tree"
