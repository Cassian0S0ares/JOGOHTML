# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões em [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-10-05 · 1ª prévia ("esqueleto andando")

### Adicionado
- Jogo jogável no navegador (port do protótipo GameMaker): exploração, vírus e combate por turnos com dados.
- Versão do build (SemVer + commit) no canto da tela e em `version.json`.
- Esteira no GitHub Actions: lint, testes, gitleaks, npm audit, SBOM, build, GDD.pdf, E2E, `build.zip` + SHA-256.
- Homologação em `/hml/` e produção em `/releases/<sha>/` com canário, promoção e rollback.
- GDD v1 em `docs/gdd.md`, convertido em PDF pela pipeline.
