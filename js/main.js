'use strict';
// Loop do jogo: step a 60 fps fixos, depois desenho do mapa (por profundidade) e da GUI

function game_step()
{
    input_begin_step();
    global.passos = (global.passos ?? 0) + 1;   // tempo de jogo, mostrado na tela de fim

    // Instâncias criadas durante este step só rodam a partir do próximo
    for (const inst of game.instances.slice())
    {
        if (inst.destroyed) continue;
        inst.xprevious = inst.x;
        inst.yprevious = inst.y;
        inst.step();
    }

    for (const inst of game.instances.slice())
    {
        if (!inst.destroyed) inst.end_step();
    }

    if (game.pending_room !== null)
    {
        const next = game.pending_room;
        game.pending_room = null;
        room_load(next);
        progresso_salvar();
    }

    musica_step(trilha_atual());
}

/// Mapa, combate ou chefe; silêncio nas telas de fim e no fim do combate (a vinheta toca sozinha)
function trilha_atual()
{
    if (instance_exists('obj_end_screen')) return null;
    const combate = instance_find(Combat);
    if (combate === noone) return 'mapa';
    if ([CombatState.victory, CombatState.defeat, CombatState.fled].includes(combate.state)) return null;
    return (combate.is_boss || combate.is_trojan) ? 'chefe' : 'combate';
}

/// Maior profundidade primeiro; empate fica na ordem de criação
const by_depth = () => game.instances.map((inst, i) => [inst, i])
    .sort((a, b) => (b[0].depth - a[0].depth) || (a[1] - b[1]))
    .map((pair) => pair[0]);

function game_draw()
{
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GUI_W, GUI_H);
    gpu_set_texfilter(false);

    // Camadas de tiles visíveis (maior profundidade primeiro): sempre por baixo das instâncias
    const layers = game.tile_layers.filter((layer) => layer.visible).sort((a, b) => b.depth - a.depth);
    for (const layer of layers) layer.draw();

    const ordered = by_depth();
    for (const inst of ordered) inst.draw();

    // GUI
    for (const inst of ordered)
    {
        if (!inst.destroyed) inst.draw_gui();
    }

    draw_set_alpha(1);
    draw_set_colour(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    gpu_set_blend_add(false);
}

let last_time = 0;
let accumulator = 0;

function frame(time)
{
    if (last_time === 0) last_time = time;
    accumulator = Math.min(accumulator + (time - last_time), STEP_MS * 5);
    last_time = time;

    let stepped = false;
    while (accumulator >= STEP_MS)
    {
        game_step();
        accumulator -= STEP_MS;
        stepped = true;
    }
    if (stepped) game_draw();

    requestAnimationFrame(frame);
}

document.getElementById('versao').textContent = 'v' + GAME_VERSION.versao + ' · ' + GAME_VERSION.sha;

// ---------------------------------------------------------------- Progresso salvo no navegador
// O mesmo que o game over usa para reiniciar a sala: a room e o global (ficha do antivírus,
// computadores do mundo 2, Firewall, chefes). Salva só em pontos sem combate pela metade.

const PROGRESSO = 'progresso';

function progresso_salvar()
{
    // O modo paz é só para testes: não vai junto
    try { localStorage.setItem(PROGRESSO, JSON.stringify({ room: game.room, global: { ...global, peace_mode: undefined } })); }
    catch { /* sem storage: o jogo segue sem salvar */ }
}

function progresso_apagar()
{
    try { localStorage.removeItem(PROGRESSO); }
    catch { /* nada salvo */ }
}

/// O progresso salvo, ou null se não houver nada além do começo do mundo 1
function progresso_ler()
{
    try
    {
        const salvo = JSON.parse(localStorage.getItem(PROGRESSO));
        if (!salvo || !GAME_DATA.rooms[salvo.room]) return null;
        const comecou = (salvo.room !== GAME_DATA.room_order[0]) || salvo.global.boss_ddos_defeated === true;
        return comecou ? salvo : null;
    }
    catch { return null; }
}

/// Menu inicial (HTML por cima do canvas): o loop só começa quando o jogador aperta Jogar ou Continuar
function menu_open()
{
    const menu = document.getElementById('menu');
    const salvo = progresso_ler();
    const opcoes = [...document.querySelectorAll('#dificuldade input')];
    const escolhida = () => opcoes.find((o) => o.checked).value;
    const mostrar_dificuldade = () =>
    {
        document.getElementById('dificuldade-texto').textContent = DIFICULDADES[escolhida()].texto
            + (salvo ? ' Vale para um novo jogo; Continuar mantém a do jogo salvo.' : '');
    };

    // A última dificuldade escolhida volta marcada
    try { opcoes.find((o) => o.value === localStorage.getItem('dificuldade'))?.click(); }
    catch { /* sem storage: fica Normal */ }
    for (const o of opcoes) o.addEventListener('change', mostrar_dificuldade);
    mostrar_dificuldade();

    const start = (progresso) =>
    {
        window.removeEventListener('keydown', on_key);
        menu.remove();
        input.queued.clear();   // o Enter que abriu o jogo não vale como ação no primeiro quadro
        canvas.focus();
        if (progresso) Object.assign(global, progresso.global);
        else
        {
            global.dificuldade = escolhida();
            try { localStorage.setItem('dificuldade', global.dificuldade); }
            catch { /* sem storage: só não lembra na próxima vez */ }
        }
        room_load(progresso ? progresso.room : GAME_DATA.room_order[0]);
        progresso_salvar();
        requestAnimationFrame(frame);
    };
    // O motor bloqueia o Enter e as setas (preventDefault), então o menu trata o teclado aqui.
    // Com progresso salvo, o Enter continua de onde parou.
    const on_key = (e) =>
    {
        if (['Enter', 'NumpadEnter', 'Space', 'KeyE'].includes(e.code)) start(salvo);
        const passo = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }[e.code];
        if (passo)
        {
            const i = opcoes.findIndex((o) => o.checked);
            opcoes[clamp(i + passo, 0, opcoes.length - 1)].click();
        }
    };

    menu.hidden = false;
    const jogar = document.getElementById('jogar');
    jogar.addEventListener('click', () => start(null));
    if (salvo)
    {
        const continuar = document.getElementById('continuar');
        continuar.hidden = false;
        continuar.textContent = 'Continuar (' + (salvo.room === 'Room2' ? 'mundo 2' : 'mundo 1') + ')';
        continuar.addEventListener('click', () => start(salvo));
        jogar.textContent = 'Novo jogo';
    }
    window.addEventListener('keydown', on_key);
}

load_sprites()
    .then(() =>
    {
        document.getElementById('loading').remove();
        menu_open();
    })
    .catch((error) =>
    {
        document.getElementById('loading').textContent = 'Erro ao carregar o jogo: ' + error.message;
        console.error(error);
    });
