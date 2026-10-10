#!/usr/bin/env bash
# Triagem como código: monta o pacote de submissão e reproduz a triagem técnica do concurso (regulamento, item 7.1).
#   SITE_URL=https://... ./scripts/triagem.sh
# Precisa de build.zip e docs/GDD.pdf (npm run build, npm run gdd:pdf e o zip, como no CI), pdfinfo/pdftotext,
# ffprobe e o Chromium do Playwright. Variáveis opcionais: PRAZO, PITCH (padrão docs/pitch.mp4), PASTA (padrão submissao).
set -uo pipefail

PASTA=${PASTA:-submissao}
PRAZO=${PRAZO:-"2026-10-21T23:59:00-03:00"}      # encerramento do concurso (item 3.1)
PITCH=${PITCH:-docs/pitch.mp4}
URL=${SITE_URL:?defina SITE_URL com a URL pública de produção}/

falhas=0
ok(){ echo "  [OK]    $1"; }
nok(){ echo "  [FALHA] $1"; falhas=$((falhas+1)); }

echo "0. Pacote em $PASTA/"
rm -rf "$PASTA" && mkdir -p "$PASTA"
cp build.zip docs/GDD.pdf "$PASTA"/ 2>/dev/null || true
[ -f "$PITCH" ] && cp "$PITCH" "$PASTA/pitch.mp4"
echo "$URL" > "$PASTA/LINK_DO_JOGO.txt"

echo "1. Prazo"
[ "$(date +%s)" -le "$(date -d "$PRAZO" +%s)" ] && ok "dentro do prazo ($PRAZO)" || nok "prazo vencido ($PRAZO)"

echo "2. Squad completo"
# Linhas da tabela que não são o cabeçalho (Nome) nem o separador (|---)
n=$(grep -E '^\|' SQUAD.md | grep -vE '^\| *(Nome|-)' | wc -l)
[ "$n" -eq 4 ] && ok "SQUAD.md com 4 integrantes" || nok "SQUAD.md com $n integrantes (precisa de 4)"

echo "3. GDD"
if pdfinfo "$PASTA/GDD.pdf" >/dev/null 2>&1; then
    ok "GDD.pdf abre"
    texto=$(pdftotext "$PASTA/GDD.pdf" - 2>/dev/null)
    for secao in Premissa "Gênero" "Mecânicas" "Referências"; do
        grep -q "$secao" <<< "$texto" && ok "GDD tem a seção $secao" || nok "GDD sem a seção $secao (item 6.3 a)"
    done
else
    nok "GDD.pdf ausente ou corrompido"
fi

echo "4. Build pública"
codigo=$(curl -sL -o /dev/null -w '%{http_code}' "$URL")
[ "$codigo" = "200" ] && ok "$URL responde 200" || nok "$URL respondeu $codigo"
BASE_URL="$URL" npx playwright test tests/e2e/smoke.spec.js --reporter=line >/dev/null 2>&1 && ok "smoke passou na URL pública" || nok "smoke falhou na URL pública"

echo "5. Build offline"
unzip -l "$PASTA/build.zip" 2>/dev/null | grep -qE ' index\.html$' && ok "build.zip com index.html" || nok "build.zip ausente ou sem index.html"

echo "6. Vídeo"
if [ -f "$PASTA/pitch.mp4" ]; then
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$PASTA/pitch.mp4" | cut -d. -f1)
    [ "${d:-999}" -le 90 ] && ok "pitch.mp4 com ${d}s" || nok "pitch.mp4 com ${d:-?}s (máx. 90, item 6.3 c)"
else
    nok "pitch.mp4 ausente ($PITCH)"
fi

echo "7. Manifesto"
(cd "$PASTA" && sha256sum -- * > MANIFESTO.sha256) && ok "MANIFESTO.sha256 gerado" && sed 's/^/          /' "$PASTA/MANIFESTO.sha256"

[ "$falhas" -eq 0 ] && echo "TRIAGEM APROVADA" || { echo "TRIAGEM REPROVADA: $falhas falha(s)"; exit 1; }
