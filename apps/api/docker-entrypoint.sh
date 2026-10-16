#!/bin/sh
set -eu

attempt=0
until pnpm --filter @sentinel/api exec prisma migrate deploy; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 15 ]; then
    echo "Database migrations failed"
    exit 1
  fi
  echo "Waiting for the database..."
  sleep 2
done

exec node apps/api/dist/server.js
