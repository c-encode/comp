#!/usr/bin/env bash
# Local dev launcher for this machine's port layout.
#   app    -> http://localhost:3001   (3000 is used by dxa-encode-frontend)
#   portal -> http://localhost:3002
#   api    -> http://localhost:3333
#   pg     -> localhost:5433          (5432 is used by composition-encode-db)
#   minio  -> localhost:9000 (console 9001)
#   redis  -> localhost:6379, Upstash-REST proxy on 8079
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> starting infrastructure containers"
(cd "$ROOT/packages/db" && docker compose up -d)
docker start comp-minio comp-redis comp-srh >/dev/null

echo "==> starting app (3001), portal (3002), api (3333)"
cd "$ROOT"
bunx concurrently --kill-others --names "app,portal,api" --prefix-colors "yellow,magenta,green" \
  "cd apps/app && NODE_OPTIONS='--no-deprecation' bunx next dev --turbo -p 3001" \
  "cd apps/portal && bunx next dev --turbopack -p 3002" \
  "cd apps/api && bunx nest start --watch --exec bun"
