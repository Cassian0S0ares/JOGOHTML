# Projeto Tuba · Relatório técnico

**Desafio Arcade** · Integração e Entrega Contínua – DevOps · 2º ADS · Faculdade SENAI
**Squad:** TODO · **Repositório:** <https://github.com/Cassian0S0ares/JOGOHTML> · **Produção:** <https://cassian0s0ares.github.io/JOGOHTML/> · **Status:** <https://cassian0s0ares.github.io/JOGOHTML/status/>

> Versão de entrega (v1.0.0, 10/10/2026). O PDF sai de `npm run relatorio:pdf`. Os itens marcados com TODO pedem um print com data, que só o squad consegue tirar.

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
| 01 Git | `main` protegida, PRs revisados, Conventional Commits, tag `v0.1.0` (05/10) e `v1.0.0` | PRs [#1](https://github.com/Cassian0S0ares/JOGOHTML/pull/1), [#9](https://github.com/Cassian0S0ares/JOGOHTML/pull/9) e [#10 a #16](https://github.com/Cassian0S0ares/JOGOHTML/pulls?q=is%3Apr); `git log --oneline v0.1.0..v1.0.0`. TODO: print da proteção da `main` |
| 02 GDD | `docs/gdd.md` → `GDD.pdf` em cada execução, anexado à Release | Artefato `build-<sha>` de cada execução em [Actions](https://github.com/Cassian0S0ares/JOGOHTML/actions/workflows/esteira.yml) e anexo da [Release v1.0.0](https://github.com/Cassian0S0ares/JOGOHTML/releases/tag/v1.0.0) |
| 03 CI | `.github/workflows/esteira.yml`: lint, testes, segurança, build, E2E, empacotamento, deploy | [Execuções da esteira](https://github.com/Cassian0S0ares/JOGOHTML/actions/workflows/esteira.yml). TODO: tempo do push até homologação da execução da v1.0.0 |
| 04 Testes | 32 testes de unidade, 50 de integração (conteúdo dos minijogos) e 7 cenários E2E (menu, abrir, andar, quiz, portal, game over, fim de jogo); JUnit e cobertura em `reports/`, com meta de 70% de linhas que reprova o `test:ci` | Artefato `reports/` de cada execução. TODO: print do relatório de cobertura |
| 05 Segurança | gitleaks, `npm audit`, SBOM CycloneDX, Dependabot, `THIRD_PARTY.md`, `AI-USAGE.md`, `LICENSE` | `reports/npm-audit.txt` e `reports/sbom.json` no artefato de cada execução; SBOM anexado à Release |
| 06 Release | `version.json` (SemVer, SHA, data), versão na tela, `build.zip` + SHA-256, GitHub Releases [v0.1.0](https://github.com/Cassian0S0ares/JOGOHTML/releases/tag/v0.1.0) e [v1.0.0](https://github.com/Cassian0S0ares/JOGOHTML/releases/tag/v1.0.0) | `build.zip` reprodutível ([#13](https://github.com/Cassian0S0ares/JOGOHTML/pull/13)): o hash da Release bate com o da produção |
| 07 Ambientes | `/hml/`, `/releases/<sha>/`, `rollout.json`, canário, rollback automático e manual | [Histórico do `gh-pages`](https://github.com/Cassian0S0ares/JOGOHTML/commits/gh-pages), com autor e motivo de cada mudança no `rollout.json`. TODO: tempo cronometrado do ensaio de rollback |
| 08 Monitoramento | `monitor.yml`, alertas `JogoForaDoAr` e `LatenciaAlta`, painel `/status/`, `scripts/dora.mjs` | [Painel /status/](https://cassian0s0ares.github.io/JOGOHTML/status/) e [Issues `alerta`](https://github.com/Cassian0S0ares/JOGOHTML/issues?q=label%3Aalerta). TODO: print do painel |
| 09 Pacote | `scripts/triagem.sh` e workflow `triagem` (diário) com o pacote `submissao/` | [Execuções da triagem](https://github.com/Cassian0S0ares/JOGOHTML/actions/workflows/triagem.yml) ([#14](https://github.com/Cassian0S0ares/JOGOHTML/pull/14)). Sem o `pitch.mp4`, a triagem reprova no item 6 de propósito |
| 10 Comunicação | Este relatório | O vídeo não foi produzido para a entrega da UC |

**Bug real encontrado por teste.** Ao rodar o E2E local no Windows, todos os cenários falharam com "elemento não encontrado". A causa estava em `scripts/servir.mjs`: no Windows, `path.normalize` troca `/` por `\`, então a URL `/` nunca virava `index.html` e o servidor respondia 404. No CI (Linux) o problema não aparecia. A correção foi aceitar as duas barras, e o próprio E2E passou a ser o teste de regressão.

## 4. Métricas DORA

Calculadas por `scripts/dora.mjs` a partir da API do GitHub e publicadas no painel `/status/`. Valores de 10/10/2026, antes do deploy da v1.0.0 (rodem o script de novo depois dele e atualizem a tabela):

| Métrica | Valor no período | Linha de base (Carparts) |
|---------|------------------|--------------------------|
| Frequência de deploy | 0 deploys de produção concluídos com sucesso | — |
| Lead time de mudança | sem deploy concluído para medir | 11 dias (264 h) |
| Taxa de falha de mudança | 100% (1 de 1: o `deploy-prd` de 06/10) | — |
| Tempo de recuperação | nenhum alerta fechado ainda | — |

**O que os dados mostraram.** O único `deploy-prd` executado, o da 997ecbd em 06/10, falhou no passo "Promover a 100% e conferir a URL pública". Mesmo assim a 997ecbd ficou como versão estável: por ser a primeira release, o `rollout.sh canario` a colocou direto como estável, e o rollback automático não tinha uma versão `anterior` para onde voltar. Rodando o mesmo smoke contra a produção em 10/10, ele passa: a falha foi do tempo de propagação do Pages, não do jogo. Os deploys seguintes (53a7494 e a7f15b4) ficaram parados esperando aprovação no environment `producao`, e é isso que mais pesa no lead time.

**Decisão de melhoria.** O gargalo não é a esteira, é a aprovação manual: o código fica pronto e espera mais de um dia pelo revisor. A decisão foi definir dois aprovadores do environment `producao` (Plataforma e SRE) e aprovar no mesmo dia do merge. TODO: depois do deploy da v1.0.0, comparar o lead time medido com as 264 h da Carparts.

## 5. Retrospectiva

**O que funcionou.** Um artefato só, gerado no `ci` e conferido pelo SHA-256 até a produção; rollback por troca de ponteiro no `rollout.json`, sem rebuild; os testes de integração do conteúdo pegando pergunta mal formada antes do deploy; o E2E local achando o bug do servidor no Windows (seção 3).

**O que não funcionou.**
- Commits direto na `main` em 09/10 (o port do GameMaker, dois ajustes de jogabilidade e a remoção das músicas), fora do fluxo de PR.
- Um commit à mão no `gh-pages` (29f401e, 05/10), antes de a pipeline assumir o branch. Daí em diante só a pipeline escreveu nele.
- A primeira release virou estável sem passar no smoke.
- Branches prontas ficaram sem PR por um dia, e a entrega atrasou um dia em relação a 09/10.
- O E2E da tela de fim passava na máquina local e falhava no runner, mais lento. O `expect.poll` espaçava os Enter até 1 s; a correção foi fixar o intervalo em 100 ms (PR [#15](https://github.com/Cassian0S0ares/JOGOHTML/pull/15)). Foi o segundo bug real pego por teste.
- A contribuição ficou concentrada em dois integrantes.

**O que mudaríamos.** Proteger a `main` desde o primeiro commit; abrir o PR junto com a branch, mesmo em rascunho; fazer a primeira release passar pelo mesmo smoke antes de virar estável; dividir os integráveis por pessoa já no dia 02/10.

## 6. Contribuição de cada integrante

| Integrante | Papel | Contribuições (PRs e commits) |
|------------|-------|-------------------------------|
| Guilherme Emanuel Gonçalves | Produto e Game Design | TODO: nenhum commit ou PR no histórico até 10/10 |
| Cassiano Luiz Brandes Soares | Desenvolvimento e Qualidade | Esteira v0.1.0 ([#1](https://github.com/Cassian0S0ares/JOGOHTML/pull/1)), build versionado, testes de unidade, integração e E2E, GDD v1, README, SQUAD, LICENSE, THIRD_PARTY e AI-USAGE, port completo do GameMaker para HTML/JS |
| João Vitor Charleaux | Plataforma e Release | TODO: nenhum commit ou PR no histórico até 10/10 |
| Davi Ferreira da Cunha | SRE e Segurança | Primeira release em produção (06/10); monitoramento, alertas, painel `/status/` e DORA ([#9](https://github.com/Cassian0S0ares/JOGOHTML/pull/9)); telas de fim e GDD no modelo do concurso ([#11](https://github.com/Cassian0S0ares/JOGOHTML/pull/11)); cobertura ([#12](https://github.com/Cassian0S0ares/JOGOHTML/pull/12)); build reprodutível ([#13](https://github.com/Cassian0S0ares/JOGOHTML/pull/13)); triagem ([#14](https://github.com/Cassian0S0ares/JOGOHTML/pull/14)); menu inicial ([#15](https://github.com/Cassian0S0ares/JOGOHTML/pull/15)); versão 1.0.0 e este relatório ([#16](https://github.com/Cassian0S0ares/JOGOHTML/pull/16)) |
