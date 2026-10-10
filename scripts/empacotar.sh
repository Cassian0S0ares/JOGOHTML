#!/usr/bin/env bash
# Empacota dist/ em build.zip de forma reprodutível: mesmo commit => mesmo SHA-256,
# seja no push da main (produção) ou no push da tag (Release).
#   empacotar.sh [saida.zip]
set -euo pipefail

saida=$(realpath -m "${1:-build.zip}")
epoch=$(git log -1 --format=%ct)          # hora do commit, não a do runner
rm -f "$saida"
find dist -exec touch -d "@$epoch" {} +
(cd dist && find . -type f | LC_ALL=C sort | TZ=UTC zip -qX "$saida" -@)
