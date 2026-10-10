---
titulo: "Projeto Tuba · Game Design Document"
---

# Projeto Tuba · Game Design Document

**Versão do GDD:** {{VERSAO}} · **Data:** {{DATA}} · **Commit:** {{SHA}}
**Repositório:** <https://github.com/Cassian0S0ares/JOGOHTML>
**Jogar (produção):** <https://cassian0s0ares.github.io/JOGOHTML/> · **Homologação:** <https://cassian0s0ares.github.io/JOGOHTML/hml/>

> Documento vivo: toda mudança de mecânica entra aqui por pull request, e a pipeline gera o `GDD.pdf` a cada build.

## 1. Premissa

**Problema.** Conceitos de segurança da informação (vírus, malware, antivírus, boas práticas de defesa) costumam chegar a quem está começando em tecnologia como teoria seca, longe da prática. Ao mesmo tempo, o raciocínio de probabilidade, essencial em programação e em análise de risco, é visto como "matemática difícil".

**Proposta.** *Projeto Tuba* é um RPG de exploração e combate por turnos em que o jogador controla o **Antivírus**, um herói que percorre os setores de um sistema infectado, protege os computadores com minijogos de segurança e enfrenta vírus, um DDoS e um Cavalo de Troia. Cada decisão de combate (atacar, entrar em Fúria, se esquivar, arriscar um Ataque Imprudente) é uma escolha de risco calculado, resolvida com dados visíveis na tela, como em D&D 5e.

**Público-alvo.** Estudantes do ensino médio e técnico e iniciantes em cursos de tecnologia (15 a 25 anos), sem pré-requisito de programação.

**O que o jogador aprende.**

- Noções de segurança digital: senhas e 2FA, phishing, atualizações, regras de firewall, DDoS e Cavalo de Troia, cada uma num minijogo ou numa luta.
- Probabilidade aplicada: chance de acerto contra uma Classe de Armadura, vantagem/desvantagem (melhor ou pior de dois d20) e valor esperado de dano.
- Gestão de recursos: Fúrias, pontos de vida e exaustão como "orçamento" de defesa.

## 2. Gênero e plataforma

- **Gênero:** RPG top-down com combate tático por turnos baseado em dados (D&D 5e simplificado) e minijogo de *timing*.
- **Plataforma:** web desktop (navegador moderno, teclado e mouse). Roda também offline a partir do `build.zip`.
- **Tecnologia:** HTML5 Canvas e JavaScript puro, sem dependências em tempo de execução; site estático publicado no GitHub Pages.

## 3. Mecânicas-core

**Loop principal.** Explorar a sala → proteger os computadores (minijogos de segurança) → enfrentar os vírus que perseguem o jogador → o chefe da sala desperta → vencê-lo e seguir para o próximo mundo. Cada inimigo derrotado dá uma "aulinha" sobre o tema da sala antes de sumir.

**Exploração.** WASD/Setas para andar, **E** para interagir com placas, computadores, o portal e o Firewall, **R** para descanso longo (5 s na fogueira: recupera PV, Fúrias e as magias do Firewall, mas só sem inimigo perseguindo). A tecla **7** liga o modo paz (só para testes: inimigos comuns param de perseguir; chefes não).

**Combate por turnos.**

- Iniciativa por d20 decide a ordem (antivírus, inimigo e, quando ele está no time, o Firewall).
- Ataque: d20 + bônus contra a CA do inimigo; 20 natural é crítico (dados de dano dobrados).
- **Fúria:** bônus de dano e resistência; termina se o jogador não atacar nem sofrer dano no turno. **Fúria Frenética** dá um ataque extra com a Ação Bônus, ao custo de 1 nível de exaustão.
- **Ataque Imprudente:** vantagem nos ataques, mas os inimigos também ganham vantagem.
- **Esquiva:** inimigos atacam com desvantagem.
- **Timing:** acertar o momento certo na barra dá bônus de dano; acertar o anel na defesa reduz o dano recebido.
- **Firewall (aliado, Mago 3):** Rajada de Fogo, Mãos Flamejantes, Raio Ardente, Poção de Brasa Viva e Esquiva. Antes de cada magia de dano vem o **ritmo das chamas** (4 notas, estilo osu!): 4 acertos dão +2d6 de fogo, 3 dão +1d4.
- Os inimigos têm ataque básico (Pseudópode, Garra Cristalina, Investida) e uma habilidade especial com recarga 5-6 no d6 (Cuspe Ácido, Cuspe Corrosivo, Chuva de Lascas).

**Minijogos dos computadores.**

| Sala | Minijogo | Conceito ensinado |
|------|----------|-------------------|
| Mundo 1 (4 computadores) | Quiz de 5 perguntas por sala: senhas e 2FA, phishing e engenharia social, malware e atualizações, redes e privacidade | Boas práticas de segurança do dia a dia |
| Mundo 2 · Caixa de Entrada | Marcar as partes suspeitas de 7 e-mails e decidir Confiar ou Quarentena | Identificar phishing (remetente, link, anexo, pressa) |
| Mundo 2 · Central de Atualizações | Escolher a ordem das atualizações enquanto um worm avança pela rede | Priorizar correções pelo que o ataque alcança primeiro |
| Mundo 2 · Regras do Firewall | Permitir ou bloquear pacotes numa esteira seguindo a lista de regras | A primeira regra que combina decide; negar por padrão; tráfego de saída suspeito |

**Progressão.**

| Mundo | Ameaças | Chefe | Conceito |
|-------|---------|-------|----------|
| 1 · Masmorra | Vírus comum | **DDoS**: um enxame que se divide em dois a cada turno; o timing do ataque decide quantos golpes e o jogador escolhe o pedaço alvo | Negação de serviço distribuída e botnets |
| 2 · Data center | Vírus de Elite (multiataque), um por sala, que só acordam quando o Firewall entra no time | **Cavalo de Troia**: o próprio Firewall tira a fantasia, rouba habilidades do antivírus a cada 3 turnos e usa contra ele | Cavalo de Troia, privilégio mínimo, defesa em camadas |

Pistas da traição ficam escondidas nas falas dos Vírus de Elite (os bytes 0x54 0x52 0x4F 0x49 0x41 formam "TROIA" em ASCII).

**Vitória e derrota.** Derrotar o chefe de um mundo faz sumir os inimigos que ainda estavam vivos. O chefe do mundo 1 abre um portal para o mundo 2 (chegar num mundo novo vale um descanso longo); vencer o Cavalo de Troia termina a história. Se os PV do antivírus chegam a zero, aparece a tela de game over e a sala reinicia (o portal e os computadores do mundo 2 continuam como estavam).

## 4. Telas

![Sala inicial: HUD com PV, CA, Fúrias e exaustão; vírus nas salas laterais; versão no canto inferior direito](img/tela-sala.png)

- **Menu:** *a definir (wireframe no Stitch).*
- **HUD:** nome e classe, barra de PV, CA, Fúrias, exaustão, a linha do Firewall quando ele está no time e os controles (canto superior esquerdo); versão do build (canto inferior direito).
- **Falas:** caixa com retrato, máquina de escrever e escolhas (conversa com o Firewall).
- **Terminal de segurança:** tela de cada minijogo de computador, com placar e explicação de cada resposta.
- **Combate:** cenário, log de rolagens, dados animados, ficha de quem está agindo e menu de ações.
- **Game over:** "Sistema comprometido", com uma dica de combate; Enter reinicia a sala.
- **Fim de jogo (zerar):** depois da última aulinha do Cavalo de Troia, "Rede protegida" com a revisão do que o jogador aprendeu em cada ameaça; Enter recomeça do mundo 1.

## 5. Referências

| Referência | Autoria | Licença / uso |
|------------|---------|---------------|
| *System Reference Document 5.1* (regras de D&D 5e) | Wizards of the Coast | CC BY 4.0 |
| GameMaker (protótipo original, portado para HTML5) | YoYo Games | Ferramenta; o código e os ativos do projeto são do squad |
| Canvas API · MDN Web Docs | Mozilla | Documentação, CC BY-SA 2.5 |

Os ativos de terceiros (sprites, sons e fontes) e as bibliotecas estão inventariados em `THIRD_PARTY.md`.

## 6. Esteira

```
feature/* → PR (revisão + CI verde) → main
   │
   ├─ ci: lint · testes (JUnit + cobertura) · gitleaks · npm audit · SBOM
   │      build (dist/ + version.json) · GDD.pdf · build.zip + SHA-256
   ├─ deploy-hml: gh-pages/hml/ → E2E Playwright na URL de homologação
   ├─ deploy-prd: aprovação no environment "producao" → gh-pages/releases/<sha>/
   │              canário 10% → smoke → promoção (ou rollback automático)
   └─ release (tag vX.Y.Z): GitHub Release com build.zip, checksum, SBOM e GDD.pdf
```

Detalhes em `README.md` e no workflow `.github/workflows/esteira.yml`.
