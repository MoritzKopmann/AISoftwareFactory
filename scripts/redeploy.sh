#!/usr/bin/env bash
# Build and deploy the aisf app from this checkout.
# Usage: scripts/redeploy.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log_file="$HOME/.aisf/redeploy.log"
app_entry="packages/app/dist/main.js"

cd "$repo_root"
mkdir -p "$(dirname "$log_file")"

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" = "main" ]; then
  echo "Updating main from origin"
  git pull --ff-only origin main
else
  echo "On branch $branch, not main: skipping pull"
fi

echo "Installing dependencies"
npm ci --no-audit --no-fund

echo "Building UI"
(cd packages/ui && npm run build)

echo "Building app"
(cd packages/app && npm run build)

echo "Stopping running app processes"
if pgrep -f "node .*${app_entry}" >/dev/null; then
  pkill -f "node .*${app_entry}" || true
  for _ in $(seq 1 20); do
    pgrep -f "node .*${app_entry}" >/dev/null || break
    sleep 0.5
  done
  if pgrep -f "node .*${app_entry}" >/dev/null; then
    echo "Processes did not stop, killing them"
    pkill -9 -f "node .*${app_entry}" || true
  fi
  echo "Stopped"
else
  echo "No running app found"
fi

echo "Starting app, log: $log_file"
: >"$log_file"
nohup node "$app_entry" >>"$log_file" 2>&1 &

for _ in $(seq 1 60); do
  if grep -q "is running at" "$log_file"; then
    grep "is running at" "$log_file"
    echo "Deployed from $(git rev-parse --short HEAD)"
    exit 0
  fi
  if ! pgrep -f "node .*${app_entry}" >/dev/null; then
    echo "App exited during start, see $log_file" >&2
    exit 1
  fi
  sleep 0.5
done

echo "App did not report running within 30s, see $log_file" >&2
exit 1
