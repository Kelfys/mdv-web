#!/usr/bin/env bash
# Adiciona ?v=BUILD_ID em imports relativos .js (evita cache de router/config antigos).
set -euo pipefail

DIST="${1:-dist}"
BUILD_ID="${2:?BUILD_ID required}"

find "$DIST/js" -name '*.js' -type f | while read -r file; do
  sed -i -E \
    -e "s|(from ['\"]\.\.?/[^'\"]+\.js)(\?v=[^'\"]+)?(['\"])|\1?v=${BUILD_ID}\3|g" \
    -e "s|(import\(['\"]\.\.?/[^'\"]+\.js)(\?v=[^'\"]+)?(['\"])|\1?v=${BUILD_ID}\3|g" \
    "$file"
done