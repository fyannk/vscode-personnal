#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node .personal-build/package-verifier.mjs
node .personal-build/verify.mjs
node .personal-build/server-smoke.mjs
mkdir -p .personal-build/dist
node .personal-build/desktop.mjs
version=$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")
archive="code-personal-$version-linux-x64.tar.gz"
tar -C .. -czf ".personal-build/dist/$archive" VSCode-linux-x64
server_archive="code-personal-server-$version-linux-x64.tar.gz"
tar -C .. -czf ".personal-build/dist/$server_archive" CodePersonal-server-linux-x64
cp ".personal-build/dist/$archive" .personal-build/arch/
sha256sum ".personal-build/dist/$archive" > ".personal-build/dist/$archive.sha256"
node .personal-build/arch-metadata.mjs "$archive"
printf 'Runnable build: %s/../VSCode-linux-x64\nArchive: %s/.personal-build/dist/%s\n' "$PWD" "$PWD" "$archive"
