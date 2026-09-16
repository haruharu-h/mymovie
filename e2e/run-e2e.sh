#!/bin/bash
set -e
cd "$(dirname "$0")"

docker compose -f ../docker-compose.e2e.yml -p mymovie-e2e up -d --wait
trap 'docker compose -f ../docker-compose.e2e.yml -p mymovie-e2e down -v' EXIT

npx playwright test
