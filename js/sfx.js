'use strict';
/// Efeitos e música sintetizados na hora (Web Audio): nenhum arquivo de áudio, nada de terceiros.
/// M ou o botão ♪ liga e desliga o som; a escolha fica no localStorage.

const som = {
    ctx: null,
    mestre: null,
    ruido: null,
    mudo: false,
    trilha: null,
    passo: 0,
    proximo: 0,
};

try { som.mudo = localStorage.getItem('som') === 'mudo'; }
catch { /* sem storage: som ligado */ }

const SOM_VOLUME = 0.5;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/// O navegador só libera áudio depois de um toque ou tecla
function som_destravar()
{
    if (!som.ctx)
    {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!Contexto) return;
        som.ctx = new Contexto();
        som.mestre = som.ctx.createGain();
        som.mestre.gain.value = som.mudo ? 0 : SOM_VOLUME;
        som.mestre.connect(som.ctx.destination);

        som.ruido = som.ctx.createBuffer(1, som.ctx.sampleRate * 0.3, som.ctx.sampleRate);
        const dados = som.ruido.getChannelData(0);
        for (let i = 0; i < dados.length; i++) dados[i] = Math.random() * 2 - 1;
    }
    if (som.ctx.state === 'suspended') som.ctx.resume();
}

function som_alternar()
{
    som.mudo = !som.mudo;
    try { localStorage.setItem('som', som.mudo ? 'mudo' : 'ligado'); }
    catch { /* sem storage: vale só nesta sessão */ }
    if (som.mestre) som.mestre.gain.value = som.mudo ? 0 : SOM_VOLUME;
    som_botao();
}

function som_botao()
{
    const botao = document.getElementById('som');
    botao.textContent = som.mudo ? '♪ desligado' : '♪ ligado';
    botao.setAttribute('aria-pressed', String(!som.mudo));
}

/// Uma nota: [midi, início (s), duração (s), onda, volume, midi final (deslize)]. Onda 'ruido' usa o buffer de ruído.
function som_nota([midi, inicio, duracao, onda = 'square', volume = 0.12, midi_fim], quando)
{
    const ctx = som.ctx;
    const t = quando + inicio;
    const ganho = ctx.createGain();
    ganho.gain.setValueAtTime(volume, t);
    ganho.gain.exponentialRampToValueAtTime(0.001, t + duracao);
    ganho.connect(som.mestre);

    let fonte;
    if (onda === 'ruido')
    {
        fonte = ctx.createBufferSource();
        fonte.buffer = som.ruido;
    }
    else
    {
        fonte = ctx.createOscillator();
        fonte.type = onda;
        fonte.frequency.setValueAtTime(hz(midi), t);
        if (midi_fim) fonte.frequency.exponentialRampToValueAtTime(hz(midi_fim), t + duracao);
    }
    fonte.connect(ganho);
    fonte.start(t);
    fonte.stop(t + duracao + 0.02);
}

const EFEITOS = {
    certo: [[72, 0, 0.08], [79, 0.08, 0.16]],
    errado: [[52, 0, 0.12], [47, 0.12, 0.25]],
    protegido: [[60, 0, 0.1], [64, 0.1, 0.1], [67, 0.2, 0.1], [72, 0.3, 0.4]],
    golpe: [[0, 0, 0.08, 'ruido', 0.25], [45, 0, 0.14, 'square', 0.18, 33]],
    dano: [[0, 0, 0.15, 'ruido', 0.3], [40, 0, 0.3, 'sawtooth', 0.18, 28]],
    erro: [[64, 0, 0.18, 'triangle', 0.15, 76]],
    cura: [[67, 0, 0.1, 'triangle', 0.2], [71, 0.08, 0.1, 'triangle', 0.2], [74, 0.16, 0.25, 'triangle', 0.2]],
    poder: [[55, 0, 0.3, 'sawtooth', 0.1, 67]],
    perfeito: [[84, 0, 0.06, 'square', 0.1], [91, 0.06, 0.14, 'square', 0.1]],
    portal: [[48, 0, 1.2, 'triangle', 0.2, 84], [55, 0.1, 1.1, 'square', 0.05, 91]],
    vitoria: [[67, 0, 0.12], [67, 0.12, 0.12], [67, 0.24, 0.12], [72, 0.36, 0.6]],
    derrota: [[64, 0, 0.3, 'triangle', 0.2], [60, 0.3, 0.3, 'triangle', 0.2], [55, 0.6, 0.3, 'triangle', 0.2], [48, 0.9, 0.9, 'triangle', 0.2]],
};

function sfx(nome)
{
    if (!som.ctx || som.ctx.state !== 'running') return;
    for (const nota of EFEITOS[nome]) som_nota(nota, som.ctx.currentTime);
}

// Trilhas originais em colcheias: baixo e melodia repetem cada um no seu tamanho, 0 é pausa
const TRILHAS = {
    mapa: {
        bpm: 92, onda: 'triangle', volume: 0.05,
        baixo: [45, 0, 0, 0, 52, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
        melodia: [69, 72, 76, 72, 69, 72, 76, 79, 65, 69, 72, 69, 67, 71, 74, 71,
            69, 72, 76, 81, 79, 76, 72, 76, 65, 69, 72, 77, 74, 71, 67, 0],
    },
    combate: {
        bpm: 150, onda: 'square', volume: 0.03,
        baixo: [40, 40, 52, 40, 40, 50, 40, 52, 38, 38, 50, 38, 43, 43, 55, 43],
        melodia: [64, 0, 67, 0, 71, 0, 69, 67, 62, 0, 65, 0, 67, 0, 0, 0,
            64, 0, 67, 0, 71, 0, 72, 71, 69, 0, 67, 0, 66, 0, 0, 0],
    },
    chefe: {
        bpm: 160, onda: 'sawtooth', volume: 0.025,
        baixo: [36, 36, 48, 36, 37, 37, 49, 37, 36, 36, 48, 36, 39, 39, 51, 38],
        melodia: [72, 0, 0, 73, 0, 0, 72, 0, 75, 0, 0, 73, 0, 72, 0, 0],
    },
};

/// Chamada a cada step: agenda as notas dos próximos 150 ms da trilha pedida (null = silêncio)
function musica_step(nome)
{
    if (!som.ctx || som.ctx.state !== 'running') return;
    const agora = som.ctx.currentTime;
    if (nome !== som.trilha)
    {
        som.trilha = nome;
        som.passo = 0;
        som.proximo = agora + 0.05;
    }
    const trilha = TRILHAS[nome];
    if (!trilha) return;

    const colcheia = 30 / trilha.bpm;
    if (som.proximo < agora) som.proximo = agora + 0.05;   // a aba ficou escondida e o relógio andou
    while (som.proximo < agora + 0.15)
    {
        const baixo = trilha.baixo[som.passo % trilha.baixo.length];
        const nota = trilha.melodia[som.passo % trilha.melodia.length];
        if (baixo) som_nota([baixo, 0, colcheia * 0.9, 'triangle', 0.08], som.proximo);
        if (nota) som_nota([nota, 0, colcheia * 0.8, trilha.onda, trilha.volume], som.proximo);
        som.passo += 1;
        som.proximo += colcheia;
    }
}

window.addEventListener('keydown', (e) =>
{
    som_destravar();
    if (e.code === 'KeyM' && !e.repeat) som_alternar();
});
window.addEventListener('pointerdown', som_destravar);
document.getElementById('som').addEventListener('click', (e) =>
{
    som_alternar();
    e.currentTarget.blur();   // devolve o teclado para o jogo
});
som_botao();
