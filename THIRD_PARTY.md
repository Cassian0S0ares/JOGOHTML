# Ativos e bibliotecas de terceiros

Todo ativo que não foi criado pelo squad precisa estar aqui, com autor, link e licença (regulamento, itens 14 e 15).

## Ativos do jogo (`assets/`)

| Arquivo | Tipo | Autor | Link | Licença |
|---------|------|-------|------|---------|
| `sprites/spr_senatir_*.png`, `spr_senatir_face_01.png` | Sprite | TODO | TODO | TODO |
| `sprites/spr_virus_*.png` | Sprite | TODO | TODO | TODO |
| `sprites/spr_antivirus_combat_axe.png` | Sprite | TODO | TODO | TODO |
| `sprites/spr_ts_dungeon.png` | Tileset | TODO | TODO | TODO |
| `sprites/spr_tree.png`, `spr_bush.png`, `spr_grass_tuft.png`, `spr_prop.png` | Sprite | TODO | TODO | TODO |
| `sprites/spr_combat_bg.png` | Fundo | TODO | TODO | TODO |
| `sprites/spr_font_ui.png` | Fonte bitmap | TODO | TODO | TODO |
| `sounds/snd_overworld_music.ogg`, `snd_combat_music.ogg` | Música | TODO | TODO | TODO |
| `sounds/snd_dice_roll.ogg` | Efeito | TODO | TODO | TODO |

## Regras do jogo

| Obra | Autor | Link | Licença |
|------|-------|------|---------|
| System Reference Document 5.1 | Wizards of the Coast | https://www.dndbeyond.com/resources/1781-systems-reference-document-srd | CC BY 4.0 |

## Bibliotecas

O jogo publicado não usa bibliotecas de terceiros. Ferramentas de desenvolvimento (só no CI, não vão para o `build.zip`):

| Pacote | Uso | Licença |
|--------|-----|---------|
| eslint, @eslint/js, globals | Lint | MIT |
| vitest, @vitest/coverage-v8 | Testes de unidade e integração | MIT |
| @playwright/test | E2E e geração do GDD.pdf | Apache-2.0 |
| marked | Markdown → HTML do GDD | MIT |

A lista completa e as versões estão no SBOM (`sbom.cyclonedx.json`) anexado a cada Release.
