'use strict';
// Loop do jogo: step a 60 fps fixos, depois desenho do mapa (por profundidade) e da GUI

function game_step()
{
    input_begin_step();

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
    }
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

load_sprites()
    .then(() =>
    {
        document.getElementById('loading').remove();
        room_load(GAME_DATA.room_order[0]);
        requestAnimationFrame(frame);
    })
    .catch((error) =>
    {
        document.getElementById('loading').textContent = 'Erro ao carregar o jogo: ' + error.message;
        console.error(error);
    });
