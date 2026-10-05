'use strict';
// Room1 e loop do jogo: step a 60 fps fixos, depois desenho do mapa (por profundidade) e da GUI

const game = {
    room_width: GAME_DATA.room.width,
    room_height: GAME_DATA.room.height,
    tilemap_walls: null,
    tilemap_dungeon_walls: null,
    tilemap_dungeon_floor: null,
    instances: [],
    player: null,
    combat: null,
    dialogue: null,
    restart_requested: false,
};

function room_start()
{
    const room = GAME_DATA.room;
    const layers = room.layers;

    // Tiles da camada "Tiles_Walls" (invisível) bloqueiam o movimento
    game.tilemap_walls = new Tilemap(layers.Tiles_Walls, room.tile_size);
    game.tilemap_dungeon_walls = new Tilemap(layers.Tiles_Dungeon_Walls, room.tile_size);
    game.tilemap_dungeon_floor = new Tilemap(layers.Tiles_Dungeon_Floor, room.tile_size);

    game.instances = [];
    game.player = null;
    game.combat = null;
    game.dialogue = null;

    // Create na ordem de criação da room
    for (const data of room.instances)
    {
        let inst = null;
        switch (data.object)
        {
            case 'obj_slime': inst = new Slime(data.x, data.y); break;
            case 'obj_prop': inst = new Prop(data.x, data.y, data.image_index); break;
            case 'obj_player': inst = new Player(data.x, data.y); game.player = inst; break;
        }
        if (inst) game.instances.push(inst);
    }

    // Room Start
    for (const inst of game.instances) inst.room_start();
}

function room_restart() { game.restart_requested = true; }

function instance_destroy(inst)
{
    game.instances = game.instances.filter((other) => other !== inst);
}

function game_step()
{
    input_begin_step();

    // Instâncias criadas durante este step (combate, falas) só rodam a partir do próximo
    const dialogue = game.dialogue;
    const combat = game.combat;

    for (const inst of game.instances.slice())
    {
        if (game.instances.includes(inst)) inst.step();
    }
    if (combat !== null && game.combat === combat) combat.step();
    if (dialogue !== null && game.dialogue === dialogue) dialogue.step();

    // End Step
    if (game.dialogue !== null) game.dialogue.end_step();

    if (game.restart_requested)
    {
        game.restart_requested = false;
        room_start();
    }
}

function game_draw()
{
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, GUI_W, GUI_H);
    gpu_set_texfilter(false);

    // Camadas de tiles (maior profundidade primeiro)
    game.tilemap_dungeon_floor.draw('spr_ts_dungeon');
    game.tilemap_dungeon_walls.draw('spr_ts_dungeon');

    // Instâncias: quem está mais embaixo na tela é desenhado na frente
    const ordered = game.instances.slice().sort((a, b) => b.depth - a.depth);
    for (const inst of ordered) inst.draw();

    // GUI
    if (game.player) game.player.draw_gui();
    if (game.combat) game.combat.draw_gui();
    if (game.dialogue) game.dialogue.draw_gui();

    draw_set_alpha(1);
    draw_set_colour(c_white);
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

load_sprites()
    .then(() =>
    {
        document.getElementById('loading').remove();
        room_start();
        requestAnimationFrame(frame);
    })
    .catch((error) =>
    {
        document.getElementById('loading').textContent = 'Erro ao carregar o jogo: ' + error.message;
        console.error(error);
    });
