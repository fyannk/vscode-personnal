#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
required_node=$(tr -d '[:space:]' < .nvmrc)
if [[ $(node --version 2>/dev/null || true) != "v$required_node" ]]; then
	if [[ -s ${NVM_DIR:-$HOME/.nvm}/nvm.sh ]]; then
		set +u
		source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
		nvm install "$required_node"
		nvm use "$required_node"
		set -u
	fi
fi
[[ $(node --version) == "v$required_node" ]] || { echo "Use Node $required_node from .nvmrc" >&2; exit 1; }
[[ $(uname -sm) == 'Linux x86_64' ]] || { echo 'This helper targets Linux x64.' >&2; exit 1; }
mkdir -p .personal-build/logs
node .personal-build/customize.mjs
# Build Linux native modules against VS Code's pinned glibc 2.28 sysroots,
# rather than the build container's rolling Arch Linux ABI. This is the same
# environment used by upstream's Linux CI and keeps both the desktop client and
# remote server runnable on their documented baseline distributions.
export npm_config_arch=x64
export VSCODE_ARCH=x64
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# setup-env.sh runs TypeScript helpers whose dependencies live in build/node_modules.
# Upstream CI installs those dependencies before loading the sysroot environment.
if [[ ${1:-} != --skip-install ]]; then
	npm ci --prefix build 2>&1 | tee .personal-build/logs/npm-ci-build.log
fi
source ./build/azure-pipelines/linux/setup-env.sh
if [[ ${1:-} != --skip-install ]]; then
	npm ci 2>&1 | tee .personal-build/logs/npm-ci.log
	npm ci --prefix .personal-build/verifier --ignore-scripts --no-audit --no-fund
fi
# This local task includes compile-copilot-extension-build after cleaning extensions.
npm run gulp vscode-linux-x64 2>&1 | tee .personal-build/logs/build.log
# Bundle the Code Personal fork of Open Remote - SSH into the desktop payload.
# Its runtime script templates remain beside the bundle because it reads them when
# creating the remote installation command.
remote_ssh_source=.personal-build/remote-ssh
remote_ssh_target=../VSCode-linux-x64/resources/app/extensions/code-personal.remote-ssh
npm ci --prefix "$remote_ssh_source" --ignore-scripts --no-audit --no-fund
npm run --prefix "$remote_ssh_source" build
rm -rf "$remote_ssh_target"
mkdir -p "$remote_ssh_target/src"
cp "$remote_ssh_source/package.json" "$remote_ssh_source/LICENSE.txt" "$remote_ssh_source/NOTICE.md" "$remote_ssh_target/"
cp "$remote_ssh_source/vendor/ssh2/LICENSE" "$remote_ssh_target/SSH2-LICENSE.txt"
cp -a "$remote_ssh_source/lib" "$remote_ssh_source/resources" "$remote_ssh_target/"
cp -a "$remote_ssh_source/src/scripts" "$remote_ssh_target/src/"
# Produce the matching remote extension host from this same customized source tree.
node build/next/index.ts bundle --minify --nls --target server --out out-vscode-reh-min 2>&1 | tee .personal-build/logs/server-bundle.log
npm run gulp vscode-reh-linux-x64-min-ci 2>&1 | tee .personal-build/logs/server-build.log
rm -rf ../CodePersonal-server-linux-x64
mv ../vscode-reh-linux-x64 ../CodePersonal-server-linux-x64
bash .personal-build/package.sh
