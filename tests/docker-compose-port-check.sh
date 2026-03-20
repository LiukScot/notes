#!/usr/bin/env bash
set -euo pipefail

config="$(docker compose config)"

if ! grep -q 'published: "3000"' <<<"$config"; then
  echo "Expected docker-compose to publish host port 3000"
  echo "$config"
  exit 1
fi

echo "docker-compose publishes host port 3000"
