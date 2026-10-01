#!/bin/bash
# Flip shared/config.js to the real HTTP adapter against the local stand-in API,
# run the full suite, then always restore the file.
set -u
cd "$(dirname "$0")/.."
CONFIG=shared/config.js
cp "$CONFIG" /tmp/config.js.bak
restore() { cp /tmp/config.js.bak "$CONFIG"; echo "— config.js restored (useMock: true) —"; }
trap restore EXIT
sed -i "s|useMock: true|useMock: false|; s|https://your-api.example.com/api/v1|http://localhost:8787/api/v1|" "$CONFIG"
grep -E "useMock|apiBaseUrl" "$CONFIG" | head -3
MODE=http timeout 300 node tools/smoke-test.js
