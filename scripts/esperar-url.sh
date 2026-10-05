#!/usr/bin/env bash
# Espera o GitHub Pages servir o commit esperado: esperar-url.sh <url-base> <sha> [tentativas]
set -euo pipefail
url=${1%/}/version.json; sha=$2; tentativas=${3:-40}
for i in $(seq "$tentativas"); do
    servido=$(curl -fsS -H 'Cache-Control: no-cache' "$url?t=$(date +%s)" 2>/dev/null | jq -r .sha 2>/dev/null || true)
    [ "$servido" = "$sha" ] && { echo "Pages servindo $sha em $url (tentativa $i)"; exit 0; }
    echo "aguardando Pages ($i/$tentativas): servido='${servido}' esperado='$sha'"
    sleep 15
done
echo "Pages não publicou $sha a tempo"; exit 1
