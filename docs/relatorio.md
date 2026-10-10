# Projeto Tuba · Relatório técnico

**Desafio Arcade** · Integração e Entrega Contínua – DevOps · 2º ADS · Faculdade SENAI
**Squad:** TODO · **Repositório:** <https://github.com/Cassian0S0ares/JOGOHTML> · **Produção:** <https://cassian0s0ares.github.io/JOGOHTML/> · **Status:** <https://cassian0s0ares.github.io/JOGOHTML/status/>

> Rascunho. Os itens marcados com TODO pedem um print (com data) ou um link de execução, PR ou Release. Limite: 12 páginas em PDF.

## 1. O que entregamos

*Projeto Tuba* é um RPG educativo de navegador sobre segurança digital e probabilidade (ver `docs/gdd.md`). O jogo nasceu no GameMaker e foi portado para HTML5 Canvas e JavaScript puro, sem dependências em tempo de execução, para caber num site estático do GitHub Pages e ser testável com Vitest e Playwright.

Tudo o que chega ao jogador passa pela esteira: nenhum arquivo do branch `gh-pages` é escrito à mão.

## 2. Arquitetura da esteira e decisões

```
feature/* ──PR──▶ main ──▶ ci ──▶ deploy-hml ──▶ [aprovação] ──▶ deploy-prd
                          │         │                              │
                          │         └ gh-pages/hml/ + E2E          ├ pages/ (carregador e /status/)
                          │                                        ├ gh-pages/releases/<sha>/
                          │                                        ├ canário 10% → smoke → observação → promover
                          │                                        └ smoke falhou → rollback automático
                          └ lint · testes · gitleaks · npm audit · SBOM · build · GDD.pdf · E2E local · build.zip + SHA-256

tag vX.Y.Z ──▶ ci ──▶ release (GitHub Release com build.zip, checksum, SBOM e GDD.pdf)
monitor (15 min) ──▶ sondas → branch observabilidade · alertas como Issues · DORA
triagem (diária) ──▶ pacote de submissão + triagem do concurso contra a produção
```

> TODO: as escolhas abaixo estão no código; os motivos das alternativas descartadas são um rascunho, confirmem com o squad.

| Decisão | Escolha | Alternativa descartada e por quê |
|---------|---------|----------------------------------|
| Branching | GitHub Flow com branches curtas e PR para a `main` protegida (1 revisão + check `ci`) | Trunk-based puro: sem PR, perderíamos a revisão obrigatória que o INT-01 pede |
| Stack do jogo | HTML5 Canvas + JS puro, com um runtime próprio no estilo GameMaker | Export HTML5 do GameMaker: gera código ofuscado, difícil de testar por unidade; Phaser: reescrita total |
| Artefato | Um `build.zip` gerado uma vez no `ci`, com SHA-256 conferido antes da produção | Rebuild por ambiente: o que foi testado em homologação não seria o mesmo byte em produção |
| Entrega progressiva | Canário com 10% das sessões, versão fixada no `localStorage` | Azul-verde: mais simples, mas a virada é para 100% de uma vez; o canário limita o estrago de uma versão ruim |
| Rollback | Trocar o ponteiro `estavel` no `rollout.json` (automático no smoke ou pelo workflow `rollback`) | Reverter o commit e reconstruir: mais lento e depende da pipeline inteira passar de novo |
| GDD em PDF | `marked` + Chromium do Playwright (`scripts/gdd-pdf.mjs`) | Pandoc: mais uma ferramenta para instalar no runner; o Chromium já estava lá por causa do E2E |
| Servidor do E2E local | `scripts/servir.mjs` (Node puro) | `npx serve`: baixaria um pacote a cada execução |
| Monitoramento | Workflow agendado gravando no branch `observabilidade` e painel estático em `/status/` | Gravar no `gh-pages`: cada sonda dispararia uma publicação do Pages |

## 3. Evidências por integrável

| INT | Evidência | Onde |
|-----|-----------|------|
| 01 Git | `main` protegida, PRs revisados, Conventional Commits, tag `v0.1.0` (05/10) e `v1.0.0` | TODO: print da proteção da `main`; links dos PRs; `git log --oneline v0.1.0..v1.0.0` |
| 02 GDD | `docs/gdd.md` → `GDD.pdf` em cada execução, anexado à Release | TODO: link do artefato `GDD.pdf` de uma execução |
| 03 CI | `.github/workflows/esteira.yml`: lint, testes, segurança, build, E2E, empacotamento, deploy | TODO: link de uma execução verde e tempo do push até homologação |
| 04 Testes | 32 testes de unidade, 50 de integração (conteúdo dos minijogos) e 6 cenários E2E (abrir, andar, quiz, portal, game over, fim de jogo); JUnit e cobertura em `reports/` | TODO: print do relatório de cobertura |
| 05 Segurança | gitleaks, `npm audit`, SBOM CycloneDX, Dependabot, `THIRD_PARTY.md`, `AI-USAGE.md`, `LICENSE` | TODO: artefatos de uma execução |
| 06 Release | `version.json` (SemVer, SHA, data), versão na tela, `build.zip` + SHA-256, GitHub Release `v0.1.0` | TODO: link da Release `v1.0.0` |
| 07 Ambientes | `/hml/`, `/releases/<sha>/`, `rollout.json`, canário, rollback automático e manual | TODO: tempo cronometrado do rollback na banca; histórico do `gh-pages` |
| 08 Monitoramento | `monitor.yml`, alertas `JogoForaDoAr` e `LatenciaAlta`, painel `/status/`, `scripts/dora.mjs` | TODO: print do painel e de uma Issue de alerta aberta e fechada |
| 09 Pacote | `scripts/triagem.sh` e workflow `triagem` (diário) com o pacote `submissao/` | TODO: link de uma triagem aprovada |
| 10 Comunicação | Vídeo de até 90 s e este relatório | TODO: link do vídeo |

**Bug real encontrado por teste.** Ao rodar o E2E local no Windows, todos os cenários falharam com "elemento não encontrado". A causa estava em `scripts/servir.mjs`: no Windows, `path.normalize` troca `/` por `\`, então a URL `/` nunca virava `index.html` e o servidor respondia 404. No CI (Linux) o problema não aparecia. A correção foi aceitar as duas barras, e o próprio E2E passou a ser o teste de regressão.

## 4. Métricas DORA

Calculadas por `scripts/dora.mjs` a partir da API do GitHub e publicadas no painel `/status/`.

| Métrica | Valor no período | Linha de base (Carparts) |
|---------|------------------|--------------------------|
| Frequência de deploy | TODO | — |
| Lead time de mudança | TODO | 11 dias |
| Taxa de falha de mudança | TODO | — |
| Tempo de recuperação | TODO | — |

**O que os dados mostraram (10/10).** O único `deploy-prd` executado até então, o da 997ecbd em 06/10, falhou no smoke. Mesmo assim a 997ecbd ficou como versão estável: por ser a primeira release, o `rollout.sh canario` a colocou direto como estável, e o rollback automático não tinha uma versão `anterior` para onde voltar. O deploy seguinte (53a7494) ficou parado esperando aprovação no environment `producao`, o que aumenta o lead time.

**Decisão de melhoria e efeito.** TODO: decidir com base nisso (por exemplo, só marcar a primeira release como estável depois do smoke, ou definir quem aprova a produção e em quanto tempo) e medir o efeito no lead time e na taxa de falha.

## 5. Retrospectiva

**O que funcionou.** TODO (sugestões a partir do histórico: um artefato só do CI à produção; rollback por ponteiro, sem rebuild; testes de conteúdo pegando pergunta mal formada antes do deploy).

**O que não funcionou.** TODO (sugestões a partir do histórico: commits direto na `main` em 09/10, fora do fluxo de PR; a primeira release virou estável sem passar no smoke; PRs do Dependabot parados; o deploy em produção esperando aprovação por mais de um dia).

**O que mudaríamos.** TODO.

## 6. Contribuição de cada integrante

| Integrante | Papel | Contribuições (PRs e commits) |
|------------|-------|-------------------------------|
| Guilherme Emanuel Gonçalves | Produto e Game Design | TODO |
| Cassiano Luiz Brandes Soares | Desenvolvimento e Qualidade | Esteira v0.1.0 (PR #1), testes, GDD v1, port completo do GameMaker para HTML/JS. TODO: links |
| João Vitor Charleaux | Plataforma e Release | TODO |
| Davi Ferreira da Cunha | SRE e Segurança | Primeira release em produção (06/10), telas de game over e fim de jogo, triagem como código, monitoramento, alertas, painel `/status/` e DORA. TODO: links dos PRs |
