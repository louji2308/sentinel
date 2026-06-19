#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/sentinel-contract"

echo "==> Building sentinel-compliance WASM contract..."
cargo build --target wasm32-wasip2 --release

echo "==> Output:"
ls -lh target/wasm32-wasip2/release/sentinel_compliance.wasm
