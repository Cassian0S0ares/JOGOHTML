# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado
- Port completo do protótipo GameMaker atual: os dois mundos (masmorra e data center) e a troca de room pelo portal.
- Computadores com minijogos: quiz por sala no mundo 1; Caixa de Entrada (phishing), Central de Atualizações (worm) e Regras do Firewall no mundo 2.
- Chefe DDoS, que se divide a cada turno; o timing do ataque decide quantos golpes e o jogador escolhe o pedaço alvo.
- Firewall: conversa com escolhas, entra no time, segue o antivírus e luta junto (magias de fogo com o minijogo de ritmo).
- Vírus de Elite (um por sala do mundo 2) e chefe final Cavalo de Troia, que rouba habilidades do antivírus.
- Aulinhas dos inimigos derrotados, descanso na fogueira, música do chefe e modo paz (tecla 7) para testes.
- Testes de unidade dos minijogos e E2E do quiz e do portal.

### Alterado
- `tools/build_assets.py` exporta todos os sprites usados, os sons e as duas rooms; sprites grandes saem reduzidos na folha.
- O jogo passou a ter um runtime no estilo GameMaker (`js/runtime.js`): objetos com herança, `instance_exists`, rooms e variáveis globais.

## [0.1.0] - 2026-10-05 · 1ª prévia ("esqueleto andando")

### Adicionado
- Jogo jogável no navegador (port do protótipo GameMaker): exploração, vírus e combate por turnos com dados.
- Versão do build (SemVer + commit) no canto da tela e em `version.json`.
- Esteira no GitHub Actions: lint, testes, gitleaks, npm audit, SBOM, build, GDD.pdf, E2E, `build.zip` + SHA-256.
- Homologação em `/hml/` e produção em `/releases/<sha>/` com canário, promoção e rollback.
- GDD v1 em `docs/gdd.md`, convertido em PDF pela pipeline.
