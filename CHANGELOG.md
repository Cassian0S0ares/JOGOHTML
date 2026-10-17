# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Menu novo: fundo de grade de rede, personagens animados, botões e seletor de dificuldade.
- Telas de fim redesenhadas: vitória com retrato, ficha da partida (dificuldade, tempo, quedas) e lições aparecendo uma a uma; game over com falha de sinal e dica sorteada.
- Controles de toque no celular: direcional e botões E, OK, Esc e R, só em tela de toque; aviso para girar o celular em pé.
- Música (mapa, combate e chefe) e efeitos sonoros sintetizados no código com Web Audio, sem arquivos de terceiros; M ou o botão ♪ liga e desliga, e a escolha fica salva.
- Dificuldade no menu (Fácil, Normal, Difícil): muda os PV e o bônus de ataque dos inimigos; fica lembrada e vai junto com o progresso.
- Progresso salvo no navegador: Continuar no menu volta ao último ponto seguro (chegada num mundo, computador protegido no mundo 2, Firewall no time, DDoS derrotado); zerar apaga.

## [1.0.0] - 2026-10-10 · entrega

### Adicionado
- Tela de game over (a sala reinicia ao continuar) e tela de fim de jogo ao derrotar o Cavalo de Troia, com a revisão do que foi aprendido.
- Menu inicial com o botão Jogar e os controles; o jogo só começa depois dele.
- Port completo do protótipo GameMaker atual: os dois mundos (masmorra e data center) e a troca de room pelo portal.
- Computadores com minijogos: quiz por sala no mundo 1; Caixa de Entrada (phishing), Central de Atualizações (worm) e Regras do Firewall no mundo 2.
- Chefe DDoS, que se divide a cada turno; o timing do ataque decide quantos golpes e o jogador escolhe o pedaço alvo.
- Firewall: conversa com escolhas, entra no time, segue o antivírus e luta junto (magias de fogo com o minijogo de ritmo).
- Vírus de Elite (um por sala do mundo 2) e chefe final Cavalo de Troia, que rouba habilidades do antivírus.
- Derrotar o chefe da room faz os inimigos que sobraram sumirem (e eles não voltam se a room reiniciar).
- Atravessar o portal para o próximo mundo vale um descanso longo (PV, Fúrias, exaustão e magias do Firewall).
- Aulinhas dos inimigos derrotados, descanso na fogueira e modo paz (tecla 7) para testes.
- Testes de unidade dos minijogos e E2E do quiz, do portal, do game over e da tela de fim.

### Corrigido
- `scripts/servir.mjs` não servia o `index.html` da raiz no Windows (E2E local falhava).

### Alterado
- Músicas removidas (mapa, combate e chefe); fica só o som dos dados.
- `tools/build_assets.py` exporta todos os sprites usados, os sons e as duas rooms; sprites grandes saem reduzidos na folha.
- O jogo passou a ter um runtime no estilo GameMaker (`js/runtime.js`): objetos com herança, `instance_exists`, rooms e variáveis globais.

## [0.1.0] - 2026-10-05 · 1ª prévia ("esqueleto andando")

### Adicionado
- Jogo jogável no navegador (port do protótipo GameMaker): exploração, vírus e combate por turnos com dados.
- Versão do build (SemVer + commit) no canto da tela e em `version.json`.
- Esteira no GitHub Actions: lint, testes, gitleaks, npm audit, SBOM, build, GDD.pdf, E2E, `build.zip` + SHA-256.
- Homologação em `/hml/` e produção em `/releases/<sha>/` com canário, promoção e rollback.
- GDD v1 em `docs/gdd.md`, convertido em PDF pela pipeline.
