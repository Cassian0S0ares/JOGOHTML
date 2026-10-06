#!/usr/bin/env bash
# Controla qual release o jogador recebe, editando rollout.json no branch gh-pages.
#   rollout.sh canario <sha> <percentual>   abre o canário (na primeira release vira estável direto)
#   rollout.sh promover                     canário vira estável (100%)
#   rollout.sh rollback [motivo]            remove o canário; sem canário, estável volta para anterior
#   rollout.sh status                       mostra o rollout.json atual
set -euo pipefail

acao=${1:?uso: rollout.sh canario|promover|rollback|status}
ator=${GITHUB_ACTOR:-$(git config user.name)}

dir=$(mktemp -d)
trap 'git worktree remove --force "$dir" 2>/dev/null || true' EXIT
git fetch -q origin gh-pages
git worktree add -q --detach "$dir" origin/gh-pages
cd "$dir"
git config user.name "${ator}"
git config user.email "${ator}@users.noreply.github.com"

[ -f rollout.json ] || echo '{"estavel":"","anterior":"","canario":"","percentual":0}' > rollout.json
editar() { jq "$1" rollout.json > rollout.tmp && mv rollout.tmp rollout.json; }
campo() { jq -r ".$1" rollout.json; }

case "$acao" in
    status) cat rollout.json; exit 0 ;;
    canario)
        sha=${2:?informe o sha}; pct=${3:-10}
        [ -d "releases/$sha" ] || { echo "releases/$sha não existe no gh-pages"; exit 2; }
        if [ -z "$(campo estavel)" ]; then
            editar ".estavel = \"$sha\" | .canario = \"\" | .percentual = 0"
            msg="primeira release $sha direto como estável"
        else
            editar ".canario = \"$sha\" | .percentual = $pct"
            msg="canário $sha em $pct%"
        fi
        ;;
    promover)
        c=$(campo canario)
        [ -n "$c" ] || { echo "sem canário para promover"; exit 0; }
        editar ".anterior = .estavel | .estavel = .canario | .canario = \"\" | .percentual = 0"
        msg="promover $c a 100%"
        ;;
    rollback)
        motivo=${2:-"sem motivo informado"}
        c=$(campo canario)
        if [ -n "$c" ]; then
            editar '.canario = "" | .percentual = 0'
            msg="rollback do canário $c ($motivo)"
        else
            a=$(campo anterior)
            [ -n "$a" ] || { echo "não há versão anterior para voltar"; exit 2; }
            editar ".estavel = .anterior | .anterior = \"\""
            msg="rollback para $a ($motivo)"
        fi
        ;;
    *) echo "ação inválida: $acao"; exit 2 ;;
esac

cat rollout.json
git add rollout.json
git commit -qm "rollout: ${msg} por ${ator}"
for tentativa in 1 2 3; do
    git push -q origin HEAD:gh-pages && break
    git pull -q --rebase origin gh-pages
done
echo "rollout: ${msg}"
