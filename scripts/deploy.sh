#!/usr/bin/env bash
# Build the site locally and deploy dist/ to the production server.
# Usage: pnpm deploy:site   (or: bash scripts/deploy.sh)
# Deploy target is read from .deploy.env (git-ignored); see .deploy.env.example.
set -euo pipefail

cd -- "$(dirname -- "$0")/.."

CONFIG_FILE=".deploy.env"
if [ ! -f "$CONFIG_FILE" ]; then
	echo "ERROR: $CONFIG_FILE not found." >&2
	echo "  Copy .deploy.env.example to .deploy.env and fill in your server." >&2
	exit 1
fi
# shellcheck disable=SC1090
. "$CONFIG_FILE"
: "${REMOTE:?REMOTE is not set in .deploy.env}"
: "${WEBROOT:?WEBROOT is not set in .deploy.env}"

echo "==> Building site..."
pnpm build

echo "==> Uploading to ${REMOTE}:${WEBROOT} ..."
tar -czf - -C dist . | ssh -o BatchMode=yes "$REMOTE" "
	set -e
	rm -rf '${WEBROOT}.new' '${WEBROOT}.old'
	mkdir -p '${WEBROOT}.new'
	tar -xzf - --no-same-owner -C '${WEBROOT}.new'
	[ -d '${WEBROOT}' ] && mv '${WEBROOT}' '${WEBROOT}.old'
	mv '${WEBROOT}.new' '${WEBROOT}'
	rm -rf '${WEBROOT}.old'
"

echo "==> Done. Site deployed to ${REMOTE}:${WEBROOT}"
