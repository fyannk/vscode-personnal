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
if [[ ${1:-} != --skip-install ]]; then
	npm ci 2>&1 | tee .personal-build/logs/npm-ci.log
	npm ci --prefix .personal-build/verifier --ignore-scripts --no-audit --no-fund
fi
# This local task includes compile-copilot-extension-build after cleaning extensions.
npm run gulp vscode-linux-x64 2>&1 | tee .personal-build/logs/build.log
# Produce the matching remote extension host from this same customized source tree.
npm run gulp vscode-reh-linux-x64-min-ci 2>&1 | tee .personal-build/logs/server-build.log
rm -rf ../CodePersonal-server-linux-x64
mv ../vscode-reh-linux-x64 ../CodePersonal-server-linux-x64
bash .personal-build/package.sh
