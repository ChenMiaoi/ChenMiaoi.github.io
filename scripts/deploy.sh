#!/usr/bin/env bash
# Compatibility entry point; Node also supports native Windows deployment.
set -euo pipefail

cd -- "$(dirname -- "$0")/.."

exec node scripts/deploy.mjs "$@"
