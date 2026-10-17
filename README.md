# Projeto Tuba

Protótipo de jogo educativo (RPG de combate por turnos sobre segurança digital e probabilidade) entregue por uma esteira CI/CD no GitHub Actions. Avaliação **Desafio Arcade** · Integração e Entrega Contínua – DevOps · 2º ADS · Faculdade SENAI.

- **Produção:** <https://cassian0s0ares.github.io/JOGOHTML/>
- **Homologação:** <https://cassian0s0ares.github.io/JOGOHTML/hml/>
- **GDD:** [`docs/gdd.md`](docs/gdd.md) (o `GDD.pdf` sai em cada execução da pipeline e em cada Release)
- **Squad:** [`SQUAD.md`](SQUAD.md)

## Como rodar

Requisitos: Git e Node.js 22 (20 também funciona).

```bash
npm ci                         # dependências de desenvolvimento (o jogo não tem dependências em produção)
npm run build                  # gera dist/ com version.json
npm run serve                  # serve dist/ em http://localhost:3000
```

Sem build, abrir o `index.html` da raiz também funciona (a versão aparece como `vdev · local`).

| Comando | O que faz |
|---------|-----------|
| `npm run lint` | ESLint |
| `npm test` | Testes de unidade e integração (Vitest) |
| `npm run test:ci` | Idem, com JUnit e cobertura em `reports/` |
| `npm run test:e2e` | E2E do Playwright contra `dist/` (ou contra `BASE_URL`) |
| `npm run build` | `dist/` + `dist/version.json` (SemVer, SHA, data) |
| `npm run gdd:pdf` | `docs/gdd.md` → `docs/GDD.pdf` |

Controles: WASD/Setas para andar, **E** para interagir, **R** para descanso longo, **7** liga o modo paz (testes).

## Estratégia de branching

**GitHub Flow** com branches curtas:

1. Crie uma branch a partir da `main`: `feature/<assunto>`, `fix/<assunto>`, `ci/<assunto>` ou `docs/<assunto>`.
2. Commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) (`feat:`, `fix:`, `ci:`, `docs:`, `test:`, `chore:`).
3. Abra um pull request para a `main`. O merge exige **1 revisão de outra pessoa** e o status check **`ci`** verde.
4. A `main` é protegida: ninguém faz push direto.
5. Releases por tag anotada SemVer (`git tag -a v0.1.0 -m "..."`). A versão do `package.json` precisa ser igual à da tag, ou o CI falha.

## Arquitetura da esteira

```
feature/* ──PR──▶ main ──▶ ci ──▶ deploy-hml ──▶ [aprovação] ──▶ deploy-prd
                          │         │                              │
                          │         └ gh-pages/hml/ + E2E          ├ gh-pages/releases/<sha>/
                          │                                        ├ canário 10% → smoke → observação → promover
                          │                                        └ smoke falhou → rollback automático
                          └ lint · testes · gitleaks · npm audit · SBOM · build · GDD.pdf · E2E local · build.zip + SHA-256

tag vX.Y.Z ──▶ ci ──▶ release (GitHub Release com build.zip, checksum, SBOM e GDD.pdf)
```

- **Um artefato, vários ambientes:** o `build.zip` é gerado uma vez no `ci`; homologação e produção descompactam o mesmo arquivo (o `deploy-prd` confere o SHA-256 antes de publicar).
- **gh-pages** (escrito só pela pipeline): `/hml/`, `/releases/<sha>/` (nunca sobrescritas), `/index.html` (carregador) e `/rollout.json` (`estavel`, `anterior`, `canario`, `percentual`).
- **Entrega progressiva:** canário com 10% das sessões; quem cai numa versão continua nela (escolha guardada no `localStorage`).
- **Triagem como código:** o workflow `triagem` (todo dia e à mão) monta `submissao/` (GDD.pdf, build.zip, LINK_DO_JOGO.txt, pitch.mp4 e MANIFESTO.sha256) e roda `scripts/triagem.sh`, que reproduz a triagem do concurso contra a produção; se reprovar, abre uma Issue `alerta`.
- **Rollback:** automático quando o smoke falha, ou manual pelo workflow `rollback` (Actions → rollback → Run workflow). Rollback é trocar o ponteiro no `rollout.json`, sem recompilar.

### Configuração do repositório (uma vez)

- **Settings → Pages:** "Deploy from a branch", branch `gh-pages`, pasta `/`.
- **Settings → Environments:** `homologacao` e `producao` (este com revisor obrigatório).
- **Settings → Variables → Actions:** `SITE_URL = https://cassian0s0ares.github.io/JOGOHTML` e, opcional, `OBSERVACAO_SEGUNDOS` (padrão 120).
- **Settings → Branches:** proteção da `main` com PR, 1 aprovação e status check `ci`.

## Monitoramento e métricas DORA

- **`monitor`** (a cada 15 min e à mão): sonda produção e homologação (código HTTP, tempo de resposta e versão servida) e grava em `status/sondas.csv` no branch `observabilidade`, para não publicar o Pages a cada sonda. O branch é criado na primeira execução.
- **Alertas como Issues** com o label `alerta`: `JogoForaDoAr` (resposta diferente de 200) e `LatenciaAlta` (mais de 2 s). Fecham sozinhos quando a sonda volta ao normal; o tempo entre abrir e fechar é o tempo de recuperação.
- **DORA:** `scripts/dora.mjs` calcula frequência de deploy, lead time, taxa de falha e tempo de recuperação pela API do GitHub e grava `status/dora.json` (linha de base da Carparts: lead time de 11 dias).
- **Painel:** <https://cassian0s0ares.github.io/JOGOHTML/status/> (disponibilidade, latência, versão, canário e DORA), publicado pela pipeline a partir de `pages/status/`.
- Limite conhecido: execuções agendadas do GitHub Actions podem atrasar alguns minutos em horários de pico.

## Dados pessoais (LGPD)

O jogo não pede nem coleta nenhum dado pessoal. O navegador guarda apenas a versão sorteada pelo canário (`localStorage`, chave `versao`) para manter o jogador na mesma versão durante a sessão.

## Estrutura

```
index.html, style.css, js/   jogo (HTML5 Canvas, scripts clássicos portados do GameMaker):
                               engine.js e runtime.js imitam o GameMaker; scr_*.js são os scripts;
                               os demais arquivos são os objetos (jogador, inimigos, Firewall, minijogos, combate)
assets/                      sprites e sons
docs/                        GDD e relatório
pages/                       carregador de produção (index.html) e painel status/, publicados na raiz do gh-pages
scripts/                     build, GDD.pdf, publicação, rollout
tests/                       unit/, integration/, e2e/
tools/build_assets.py        exporta sprites, sons e as rooms do projeto GameMaker para assets/ e js/data.js
.github/workflows/           esteira.yml, rollback.yml
```
