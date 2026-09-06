#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
docker build --tag code-personal-builder --file Dockerfile .
exec docker run --rm --init --shm-size=2g \
	--env CODE_PERSONAL_CONTAINER=1 \
	--volume "$PWD:/workspace" --workdir /workspace \
	code-personal-builder bash scripts/container-entry.sh "$@"
