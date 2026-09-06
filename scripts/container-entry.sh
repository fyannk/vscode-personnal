#!/usr/bin/env bash
set -euo pipefail
cd /workspace
owner_uid=$(stat -c '%u' /workspace)
[[ $owner_uid != 0 ]] || { echo 'Run the container from a checkout owned by a normal user.' >&2; exit 1; }
useradd --create-home --uid "$owner_uid" builder
# Git/npm/makepkg and the application run as an unprivileged user.
exec runuser -u builder -- bash scripts/build.sh "$@"
