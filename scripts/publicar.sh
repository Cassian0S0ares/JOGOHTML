#!/usr/bin/env bash
# Publica o build.zip no branch gh-pages (só a pipeline escreve nele).
#   publicar.sh hml <build.zip>            -> gh-pages/hml/ (substitui a homologação)
#   publicar.sh release <build.zip> <sha>  -> gh-pages/releases/<sha>/ (nunca sobrescreve)
set -euo pipefail

modo=${1:?uso: publicar.sh hml|release <build.zip> [sha]}
zip=$(realpath "${2:?informe o build.zip}")
sha=${3:-}
ator=${GITHUB_ACTOR:-$(git config user.name)}

dir=$(mktemp -d)
trap 'git worktree remove --force "$dir" 2>/dev/null || true' EXIT
git fetch -q origin gh-pages
git worktree add -q --detach "$dir" origin/gh-pages
cd "$dir"
git config user.name "${ator}"
git config user.email "${ator}@users.noreply.github.com"

case "$modo" in
    hml)
        rm -rf hml && mkdir hml
        unzip -q "$zip" -d hml
        destino="hml/"
        ;;
    release)
        [ -n "$sha" ] || { echo "informe o sha da release"; exit 2; }
        if [ -d "releases/$sha" ]; then
            echo "releases/$sha já publicada; nada a fazer (releases nunca são sobrescritas)"
            exit 0
        fi
        mkdir -p "releases/$sha"
        unzip -q "$zip" -d "releases/$sha"
        destino="releases/$sha/"
        ;;
    *) echo "modo inválido: $modo"; exit 2 ;;
esac

git add -A
git commit -qm "deploy: ${destino} ($(cat "$destino/version.json" | tr -d '\n ' )) por ${ator}"
for tentativa in 1 2 3; do
    git push -q origin HEAD:gh-pages && break
    git pull -q --rebase origin gh-pages
done
echo "publicado em ${destino}"
