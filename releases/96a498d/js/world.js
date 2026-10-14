'use strict';
// Objetos do mapa: decorações (scr_decor), placas (obj_prop), computadores (obj_computer) e o portal (obj_portal)

// ---------------------------------------------------------------- Decorações (scr_decor)

/// Base sólida de cada frame em tiles: [largura, altura]. [0, 0] = sem colisão.
const DECOR_FOOTPRINTS = {
    // 0: arvore_1, 1: arvore_2, 2: arvore_3
    spr_tree: [[1, 1], [1, 1], [1, 1]],
    // 0: arbusto_1 ... 5: arbusto_6
    spr_bush: [[1, 1], [1, 1], [1, 1], [1, 1], [0, 0], [0, 0]],
    // 0..15: tufos de grama
    spr_grass_tuft: Array.from({ length: 16 }, () => [0, 0]),
    // 0, 1: computador ligado, 2: computador resolvido
    spr_computer: [[1, 1], [1, 1], [1, 1]],
    // 0: caixote, 1: caixote_pequeno, 2: bau, 3: barril, 4: jarro_a, 5: jarro_b, 6: jarro_c, 7: placa_leste, 8: placa_oeste,
    // 9: estela_baixa, 10: estela_alta, 11: pedra_quebrada, 12: banco, 13: caixao, 14: tumulo, 15: lapide_rip, 16: lapide_pequena,
    // 17: cruz, 18: bloco_pedra, 19: estatua, 20: lanterna, 21: pilar, 22: pilar_quebrado, 23: altar, 24: poco_ruina,
    // 25: rocha_grande, 26: rocha_a, 27: rocha_b, 28-33: pedrinhas
    spr_prop: [[1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [2, 1], [2, 1], [1, 1], [1, 1], [1, 1],
        [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [1, 1], [3, 2], [2, 1], [2, 1], [1, 1], [1, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
};

function decor_footprint(sprite, frame)
{
    const list = DECOR_FOOTPRINTS[sprite];
    if (!list) return [0, 0];
    return list[clamp(Math.floor(frame), 0, list.length - 1)];
}

/// Room Start de cada decoração: congela o frame, ordena por Y e marca a base como sólida na camada de colisão.
/// A origem do sprite fica no pé do objeto; objetos de largura par ficam na borda entre dois tiles, os de largura ímpar no centro de um tile.
function decor_setup(inst)
{
    inst.depth = -inst.y;

    const footprint = decor_footprint(inst.sprite_index, inst.image_index);
    if (footprint[0] <= 0) return;

    const tilemap = layer_tilemap('Tiles_Walls');
    const ts = tilemap.tile_size;
    const left = inst.x - footprint[0] * ts / 2;
    const top = inst.y - footprint[1] * ts;

    for (let row = 0; row < footprint[1]; row++)
    {
        for (let column = 0; column < footprint[0]; column++)
        {
            tilemap.set_at_pixel(1, left + column * ts + 1, top + row * ts + 1);
        }
    }
}

class Decor extends Instance
{
    room_start() { decor_setup(this); }
}

class Tree extends Decor
{
    static object = 'obj_tree';
    create() { this.sprite_index = 'spr_tree'; }
}

class Bush extends Decor
{
    static object = 'obj_bush';
    create() { this.sprite_index = 'spr_bush'; }
}

class GrassTuft extends Decor
{
    static object = 'obj_grass_tuft';
    create() { this.sprite_index = 'spr_grass_tuft'; }
}

// ---------------------------------------------------------------- Placas e objetos (obj_prop)

class Prop extends Decor
{
    static object = 'obj_prop';

    create()
    {
        this.sprite_index = 'spr_prop';

        // Preenchido nas placas: falas mostradas quando o antivírus lê
        this.read_lines = undefined;

        switch (Math.floor(this.image_index))
        {
            case 7: // placa_leste
                this.read_lines = [
                    dialogue_line('Senatir', '"A LESTE: RUÍNAS DO POÇO VELHO". Embaixo, riscado fundo na madeira: "Eu vou em busca de duas".'),
                    dialogue_line('Senatir', 'A tinta da placa está velha, mas o risco é novo. Alguém passou por aqui depois e quis avisar.'),
                    dialogue_line('Senatir', '.'),
                    dialogue_line('Senatir', '..'),
                    dialogue_line('Senatir', '...'),
                    dialogue_line('Senatir', 'O que ele quis dizer com isso?'),
                ];
                break;

            case 8: // placa_oeste
                this.read_lines = [
                    dialogue_line('Senatir', '"A OESTE: CAMPO DE LÁPIDES". O resto da placa está rachado e não dá para ler.'),
                    dialogue_line('Senatir', 'Dizem que enterraram ali os primeiros moradores do vale, antes da guerra.'),
                    dialogue_line('Senatir', 'Descanse em paz.'),
                ];
                break;
        }
    }
}

// ---------------------------------------------------------------- Computador com minijogo (obj_computer)

class Computer extends Decor
{
    static object = 'obj_computer';

    create()
    {
        this.sprite_index = 'spr_computer';

        // Room1: quiz, o tema depende da sala (0 esquerda topo, 1 direita topo, 2 esquerda baixo, 3 direita baixo)
        // Room2: cada sala tem um minijogo diferente (scr_terminal)
        this.terminal_kind = terminal_kind_at(this.x, this.y);
        this.quiz_topic = quiz_topic_at(this.x, this.y);
        this.quiz_title = terminal_get_title(this.terminal_kind, this.quiz_topic);

        // Melhor resultado já feito aqui; acertar tudo deixa a tela verde
        this.best_score = 0;
        this.solved = computer_was_solved(this);

        this.blink_timer = 0;
    }

    step()
    {
        // Frames: 0 e 1 cursor piscando, 2 resolvido
        if (this.solved)
        {
            this.image_index = 2;
        }
        else
        {
            this.blink_timer += 1;
            this.image_index = Math.floor(this.blink_timer / 30) % 2;
        }
    }
}

// ---------------------------------------------------------------- Portal para o próximo mundo (obj_portal)

class Portal extends Instance
{
    static object = 'obj_portal';

    create()
    {
        this.sprite_index = 'spr_portal';

        // Para onde leva
        this.target_room = 'Room2';

        this.map_scale = 0.22;       // o sprite é 512x512
        this.appear = 0;             // cresce do nada ao surgir
        this.anim_time = 0;

        // Entrando: tela clareia e troca de room
        this.entering = false;
        this.enter_timer = 0;
        this.enter_duration = 70;

        this.image_xscale = this.map_scale;
        this.image_yscale = this.map_scale;
        this.depth = -this.y;
    }

    enter()
    {
        if (this.entering) return;
        this.entering = true;
        this.enter_timer = 0;
    }

    step()
    {
        this.anim_time += 1;
        this.image_index = Math.floor(this.anim_time / 7) % sprite_get_number(this.sprite_index);

        // Surge com um leve exagero e assenta no tamanho final
        this.appear = Math.min(1, this.appear + 1 / 60);
        const grow = (this.appear < 1) ? 1 + Math.sin(this.appear * Math.PI) * 0.25 : 1;
        this.image_xscale = this.map_scale * this.appear * grow;
        this.image_yscale = this.map_scale * this.appear * grow;

        if (!this.entering) return;

        this.enter_timer += 1;
        if (this.enter_timer >= this.enter_duration)
        {
            // Leva a ficha do antivírus para o próximo mundo
            for (const player of instances_of('obj_player'))
            {
                global.hero_state = { hp: player.hp, rage_uses: player.rage_uses, exhaustion: player.exhaustion, ally: firewall_save(player.ally) };
            }
            global.arrived_by_portal = true;
            room_goto(this.target_room);
        }
    }

    draw()
    {
        // Brilho de chão embaixo do portal
        const pulse = 0.5 + 0.5 * Math.sin(this.anim_time * 0.08);
        draw_set_alpha(this.appear * (0.25 + 0.15 * pulse));
        draw_set_colour(make_colour_rgb(170, 80, 255));
        draw_ellipse(this.x - 52 * this.appear, this.y - 10, this.x + 52 * this.appear, this.y + 8, false);
        draw_set_alpha(1);
        draw_set_colour(c_white);

        // O sprite é grande sendo reduzido: aqui a suavização ajuda
        gpu_set_texfilter(true);
        this.draw_self();
        gpu_set_texfilter(false);
    }

    /// Clarão ao atravessar
    draw_gui()
    {
        if (!this.entering) return;

        const k = clamp(this.enter_timer / this.enter_duration, 0, 1);
        draw_set_alpha(k);
        draw_set_colour(merge_colour(make_colour_rgb(170, 80, 255), c_white, k));
        draw_rectangle(0, 0, GUI_W, GUI_H, false);
        draw_set_alpha(1);
        draw_set_colour(c_white);
    }
}

Object.assign(OBJECTS, { obj_tree: Tree, obj_bush: Bush, obj_grass_tuft: GrassTuft, obj_prop: Prop, obj_computer: Computer, obj_portal: Portal });
