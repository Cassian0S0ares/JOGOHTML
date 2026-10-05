'use strict';
// Mapa: tilemaps, colisão, decorações, antivírus (jogador), vírus e placas

// ---------------------------------------------------------------- Tilemap

class Tilemap
{
    constructor(layer, tile_size)
    {
        this.width = layer.w;
        this.height = layer.h;
        this.tile_size = tile_size;
        this.tiles = layer.tiles.slice();
    }

    /// Mesmo comportamento do tilemap_get_at_pixel: -1 fora do tilemap
    get_at_pixel(px, py)
    {
        const cx = Math.floor(px / this.tile_size);
        const cy = Math.floor(py / this.tile_size);
        if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return -1;
        return this.tiles[cy * this.width + cx];
    }

    set_at_pixel(value, px, py)
    {
        const cx = Math.floor(px / this.tile_size);
        const cy = Math.floor(py / this.tile_size);
        if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return;
        this.tiles[cy * this.width + cx] = value;
    }

    /// Desenha a camada usando a folha do tileset (índice 0 = vazio)
    draw(sprite_name)
    {
        const spr = sprites[sprite_name];
        const columns = Math.floor(spr.w / this.tile_size);
        const ts = this.tile_size;
        ctx.globalAlpha = 1;
        for (let i = 0; i < this.tiles.length; i++)
        {
            const tile = this.tiles[i] & 0x7FFFF;
            if (tile === 0) continue;
            ctx.drawImage(spr.img, (tile % columns) * ts, Math.floor(tile / columns) * ts, ts, ts,
                (i % this.width) * ts, Math.floor(i / this.width) * ts, ts, ts);
        }
    }
}

/// Retorna true se o retângulo (em pixels, inclusivo) sai da room ou toca algum tile não vazio.
function tilemap_rect_blocked(tilemap, left, top, right, bottom)
{
    if (left < 0 || right >= game.room_width || top < 0 || bottom >= game.room_height) return true;

    // Amostra pontos com espaçamento menor que um tile, para nenhum tile passar entre eles
    const step_x = tilemap.tile_size - 1;
    const step_y = tilemap.tile_size - 1;

    for (let py = top; ; py = Math.min(py + step_y, bottom))
    {
        for (let px = left; ; px = Math.min(px + step_x, right))
        {
            if (tilemap.get_at_pixel(px, py) !== 0) return true;
            if (px >= right) break;
        }
        if (py >= bottom) break;
    }

    return false;
}

const rectangles_overlap = (a1, b1, c1, d1, a2, b2, c2, d2) => a1 <= c2 && c1 >= a2 && b1 <= d2 && d1 >= b2;

// ---------------------------------------------------------------- Decorações (scr_decor)

/// Base sólida de cada frame em tiles: [largura, altura]. [0, 0] = sem colisão.
const DECOR_FOOTPRINTS = {
    // 0: arvore_1, 1: arvore_2, 2: arvore_3
    spr_tree: [[1, 1], [1, 1], [1, 1]],
    // 0: arbusto_1 ... 5: arbusto_6
    spr_bush: [[1, 1], [1, 1], [1, 1], [1, 1], [0, 0], [0, 0]],
    // 0..15: tufos de grama
    spr_grass_tuft: Array.from({ length: 16 }, () => [0, 0]),
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

    const tilemap = game.tilemap_walls;
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

// ---------------------------------------------------------------- Movimento com colisão (comum)

/// Move deslizando rente às paredes: se o passo inteiro bate, avança pixel a pixel até encostar
function move_with_collision(inst, move_x, move_y)
{
    if (inst.is_blocked(inst.x + move_x, inst.y))
    {
        while (!inst.is_blocked(inst.x + sign(move_x), inst.y)) inst.x += sign(move_x);
    }
    else
    {
        inst.x += move_x;
    }

    if (inst.is_blocked(inst.x, inst.y + move_y))
    {
        while (!inst.is_blocked(inst.x, inst.y + sign(move_y))) inst.y += sign(move_y);
    }
    else
    {
        inst.y += move_y;
    }
}

// ---------------------------------------------------------------- Placas e objetos (obj_prop)

class Prop
{
    constructor(x, y, image_index)
    {
        this.kind = 'prop';
        this.x = x;
        this.y = y;
        this.sprite_index = 'spr_prop';
        this.image_index = image_index;
        this.depth = 0;

        // Preenchido nas placas: falas mostradas quando o antivírus lê
        this.read_lines = undefined;

        switch (Math.floor(image_index))
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

    room_start() { decor_setup(this); }

    step() {}

    /// position_meeting com a caixa de colisão retangular do sprite
    contains_point(px, py)
    {
        const spr = sprites[this.sprite_index];
        return point_in_rectangle(px, py,
            this.x - spr.xo + spr.bbox[0], this.y - spr.yo + spr.bbox[1],
            this.x - spr.xo + spr.bbox[2], this.y - spr.yo + spr.bbox[3]);
    }

    draw() { draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y, 1, 1, 0, c_white, 1); }
}

// ---------------------------------------------------------------- Antivírus (obj_player)

class Player
{
    constructor(x, y)
    {
        this.kind = 'player';
        this.x = x;
        this.y = y;
        this.depth = -y;

        // Ficha: Bárbaro nível 3 (D&D 5e), Caminho do Berserker
        this.char_name = 'Antivírus';
        this.char_class = 'Bárbaro 3 - Berserker';
        this.level = 3;
        this.proficiency_bonus = 2;

        // Conjunto padrão (15, 14, 13, 12, 10, 8) + 1 em tudo (humano)
        this.strength = 16;
        this.dexterity = 14;
        this.constitution = 15;
        this.intelligence = 9;
        this.wisdom = 13;
        this.charisma = 11;

        // PV: d12 cheio no 1º nível + média (7) nos níveis 2 e 3, sempre + Constituição
        this.hp_max_base = (12 + ability_modifier(this.constitution)) + (this.level - 1) * (7 + ability_modifier(this.constitution));
        this.hp = this.hp_max_base;

        // Defesa sem Armadura: 10 + Destreza + Constituição
        this.armor_class = 10 + ability_modifier(this.dexterity) + ability_modifier(this.constitution);

        this.weapon_name = 'Machado Grande';
        this.weapon_dice_count = 1;
        this.weapon_dice_sides = 12;

        this.rage_uses_max = 3;
        this.rage_uses = this.rage_uses_max;
        this.rage_damage_bonus = 2;

        // Exaustão: 1 desvantagem em testes de atributo, 2 deslocamento pela metade,
        // 3 desvantagem em ataques e TR, 4 PV máximo pela metade, 5 deslocamento 0, 6 morte
        this.exhaustion = 0;

        // Leitura de placas: alcance e placa que está ao alcance agora
        this.read_range = 72;
        this.readable_prop = null;

        // Frames sem novos encontros depois de um combate
        this.encounter_cooldown = 0;
        this.rest_message = '';
        this.rest_message_timer = 0;

        this.move_speed = 3;
        this.anim_speed = 0.15;
        this.anim_frame = 0;
        this.is_moving = false;

        this.sprite_index = 'spr_senatir_down';
        this.image_index = 0;

        // Ampliação uniforme: preserva as proporções e a origem nos pés
        this.image_xscale = 1.3;
        this.image_yscale = 1.3;

        // Caixa de colisão só dos pés, relativa à origem (base do sprite): a cabeça pode passar na frente das paredes
        this.hitbox_left = -10;
        this.hitbox_right = 10;
        this.hitbox_top = -14;
        this.hitbox_bottom = -1;
    }

    get_hp_max() { return (this.exhaustion >= 4) ? Math.floor(this.hp_max_base / 2) : this.hp_max_base; }

    is_blocked(x, y)
    {
        return tilemap_rect_blocked(game.tilemap_walls, x + this.hitbox_left, y + this.hitbox_top, x + this.hitbox_right, y + this.hitbox_bottom);
    }

    room_start() {}

    step()
    {
        // O mapa congela durante o combate e durante as falas
        if (game.combat !== null) return;
        if (dialogue_is_active()) return;

        if (this.encounter_cooldown > 0) this.encounter_cooldown -= 1;
        if (this.rest_message_timer > 0) this.rest_message_timer -= 1;

        // Descanso longo: recupera PV e Fúrias e reduz 1 nível de exaustão
        if (keyboard_check_pressed(ord('R')))
        {
            const in_danger = game.instances.some((inst) => inst.kind === 'slime' && inst.is_chasing);

            if (in_danger)
            {
                this.rest_message = 'Não dá para descansar com um inimigo te perseguindo!';
            }
            else
            {
                this.exhaustion = Math.max(0, this.exhaustion - 1);
                this.hp = this.get_hp_max();
                this.rage_uses = this.rage_uses_max;
                this.rest_message = 'Descanso longo: PV e Fúrias restaurados.';
            }
            this.rest_message_timer = 150;
        }

        // Ler placas: placa mais próxima dentro do alcance
        this.readable_prop = null;
        let best_distance = this.read_range;
        for (const inst of game.instances)
        {
            if (inst.kind !== 'prop' || inst.read_lines === undefined) continue;

            const distance = point_distance(inst.x, inst.y, this.x, this.y);
            if (distance < best_distance)
            {
                best_distance = distance;
                this.readable_prop = inst;
            }
        }

        if (this.readable_prop !== null)
        {
            const pressed = keyboard_check_pressed(ord('E')) || keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space);
            const clicked = mouse_check_button_pressed() && this.readable_prop.contains_point(input.mouse_x, input.mouse_y);

            if (pressed || clicked)
            {
                dialogue_start(this.readable_prop.read_lines);
                return;
            }
        }

        let speed = this.move_speed;
        if (this.exhaustion >= 5) speed = 0;
        else if (this.exhaustion >= 2) speed = this.move_speed / 2;

        const input_x = (keyboard_check(vk_right) || keyboard_check(ord('D'))) - (keyboard_check(vk_left) || keyboard_check(ord('A')));
        const input_y = (keyboard_check(vk_down) || keyboard_check(ord('S'))) - (keyboard_check(vk_up) || keyboard_check(ord('W')));

        this.is_moving = (input_x !== 0 || input_y !== 0) && speed > 0;

        if (this.is_moving)
        {
            // Normaliza para não andar mais rápido na diagonal
            const length = Math.hypot(input_x, input_y);
            move_with_collision(this, input_x / length * speed, input_y / length * speed);

            // Direção do sprite: prioriza o eixo horizontal
            if (input_x > 0) this.sprite_index = 'spr_senatir_right';
            else if (input_x < 0) this.sprite_index = 'spr_senatir_left';
            else if (input_y > 0) this.sprite_index = 'spr_senatir_down';
            else this.sprite_index = 'spr_senatir_up';

            this.anim_frame += this.anim_speed;
            this.image_index = this.anim_frame;
        }
        else
        {
            this.anim_frame = 0;
            this.image_index = 0;
        }

        // Quem está mais embaixo na tela é desenhado na frente
        this.depth = -this.y;
    }

    draw()
    {
        draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y, this.image_xscale, this.image_yscale, 0, c_white, 1);
    }

    /// HUD do antivírus
    draw_gui()
    {
        if (game.combat !== null) return;

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        ui_draw_panel(8, 8, 408, 96);

        draw_set_colour(c_aqua);
        draw_text(18, 14, this.char_name + ' - ' + this.char_class);

        ui_draw_bar(18, 40, 140, 12, this.hp, this.get_hp_max(), c_lime);
        draw_set_colour(c_white);
        draw_text(168, 36, 'PV ' + this.hp + '/' + this.get_hp_max() + '  CA ' + this.armor_class);

        draw_set_colour(c_orange);
        draw_text(18, 58, 'Fúrias ' + this.rage_uses + '/' + this.rage_uses_max);
        draw_set_colour((this.exhaustion > 0) ? c_red : c_white);
        draw_text(168, 58, 'Exaustão ' + this.exhaustion);

        draw_set_colour(c_gray);
        draw_text(18, 76, 'WASD/Setas: andar   R: descanso longo   E: interagir');

        if (this.rest_message_timer > 0)
        {
            draw_set_alpha(Math.min(1, this.rest_message_timer / 30));
            draw_set_colour(c_yellow);
            draw_text(18, 104, this.rest_message);
            draw_set_alpha(1);
        }

        draw_set_colour(c_white);

        // Aviso flutuante em cima da placa que dá para ler
        if (this.readable_prop !== null && !dialogue_is_active())
        {
            draw_set_halign(fa_center);
            ui_draw_text_shadow(this.readable_prop.x, this.readable_prop.y - 72, 'E: ler a placa', c_yellow);
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }
    }
}

// ---------------------------------------------------------------- Vírus (obj_slime)

class Slime
{
    constructor(x, y)
    {
        this.kind = 'slime';
        this.x = x;
        this.y = y;
        this.depth = -y;

        // Ficha: baseada na Gosma Cinzenta (Gray Ooze, ND 1/2) de D&D 5e
        this.monster_name = 'Vírus';
        this.armor_class = 8;
        this.hp_max = 22;
        this.hp = this.hp_max;
        this.dexterity = 6;

        // Pseudópode: +3 para acertar, 1d6+1 contundente + 2d6 ácido
        this.attack_bonus = 3;
        this.pseudopod_bonus = 1;

        // Cuspe Ácido (adição, recarga 5-6): TR de Destreza CD 11, 2d6 ácido, metade se passar
        this.acid_spit_ready = true;
        this.acid_spit_dc = 11;

        // Depois que o player foge, fica atordoado e não persegue nem inicia combate
        this.stun_timer = 0;

        this.move_speed = 1;
        this.anim_speed = 0.12;
        this.anim_frame = random(4);
        this.sprite_index = 'spr_virus_down';
        this.image_index = 0;

        // Alterna entre parado e andando por tempos aleatórios (em frames)
        this.idle_time_min = 30;
        this.idle_time_max = 120;
        this.walk_time_min = 60;
        this.walk_time_max = 180;

        // Persegue o player quando ele chega perto; desiste só bem mais longe
        this.chase_speed = 1.8;
        this.chase_start_distance = 140;
        this.chase_stop_distance = 240;
        this.chase_min_distance = 14;
        this.is_chasing = false;
        this.alert_timer = 0;

        this.is_moving = false;
        this.state_timer = irandom_range(this.idle_time_min, this.idle_time_max);
        this.move_x = 0;
        this.move_y = 0;

        // Caixa de colisão do corpo inteiro (parte visível do sprite), relativa à origem (base do sprite)
        this.hitbox_left = -14;
        this.hitbox_right = 13;
        this.hitbox_top = -18;
        this.hitbox_bottom = -1;
    }

    is_blocked(x, y)
    {
        return tilemap_rect_blocked(game.tilemap_walls, x + this.hitbox_left, y + this.hitbox_top, x + this.hitbox_right, y + this.hitbox_bottom);
    }

    room_start() {}

    step()
    {
        // O mapa congela durante o combate e durante as falas
        if (game.combat !== null) return;
        if (dialogue_is_active()) return;

        const previous_x = this.x;
        const previous_y = this.y;

        if (this.stun_timer > 0) this.stun_timer -= 1;

        const target = game.player;
        const target_distance = target ? point_distance(this.x, this.y, target.x, target.y) : Infinity;

        if (!this.is_chasing && this.stun_timer <= 0 && target_distance < this.chase_start_distance)
        {
            this.is_chasing = true;
            this.alert_timer = 40;
        }
        else if (this.is_chasing && target_distance > this.chase_stop_distance)
        {
            // Perdeu o player de vista: fica parado um pouco antes de voltar a vagar
            this.is_chasing = false;
            this.is_moving = false;
            this.state_timer = irandom_range(this.idle_time_min, this.idle_time_max);
        }

        if (this.alert_timer > 0) this.alert_timer -= 1;

        if (this.is_chasing)
        {
            this.is_moving = target_distance > this.chase_min_distance;

            if (this.is_moving)
            {
                const dir = point_direction(this.x, this.y, target.x, target.y);
                this.move_x = lengthdir_x(this.chase_speed, dir);
                this.move_y = lengthdir_y(this.chase_speed, dir);

                // Desliza rente às paredes em vez de quicar, para não travar
                move_with_collision(this, this.move_x, this.move_y);
            }
        }
        else
        {
            this.state_timer -= 1;

            if (this.state_timer <= 0)
            {
                if (this.is_moving)
                {
                    this.is_moving = false;
                    this.state_timer = irandom_range(this.idle_time_min, this.idle_time_max);
                }
                else
                {
                    const dir = random(360);
                    this.move_x = lengthdir_x(this.move_speed, dir);
                    this.move_y = lengthdir_y(this.move_speed, dir);
                    this.is_moving = true;
                    this.state_timer = irandom_range(this.walk_time_min, this.walk_time_max);
                }
            }

            if (this.is_moving)
            {
                // Ao bater numa parede, inverte a direção naquele eixo
                if (this.is_blocked(this.x + this.move_x, this.y)) this.move_x = -this.move_x;
                else this.x += this.move_x;

                if (this.is_blocked(this.x, this.y + this.move_y)) this.move_y = -this.move_y;
                else this.y += this.move_y;
            }
        }

        const actual_x = this.x - previous_x;
        const actual_y = this.y - previous_y;
        if (actual_x !== 0 || actual_y !== 0)
        {
            // Olha na direção do deslocamento real, inclusive ao deslizar pelas paredes
            let sprite;
            if (Math.abs(actual_x) >= Math.abs(actual_y)) sprite = (actual_x > 0) ? 'spr_virus_right' : 'spr_virus_left';
            else sprite = (actual_y > 0) ? 'spr_virus_down' : 'spr_virus_up';

            if (this.sprite_index !== sprite)
            {
                this.sprite_index = sprite;
                this.anim_frame = 0;
            }

            this.anim_frame += this.is_chasing ? this.anim_speed * 1.5 : this.anim_speed;
        }
        else
        {
            // Parado, continua "respirando" mais devagar
            this.anim_frame += this.anim_speed * 0.4;
        }

        this.anim_frame = this.anim_frame % 4;
        this.image_index = this.anim_frame;

        // Quem está mais embaixo na tela é desenhado na frente
        this.depth = -this.y;

        // Encostou no player: começa o combate por turnos
        if (target && this.stun_timer <= 0 && target.encounter_cooldown <= 0)
        {
            const touching = rectangles_overlap(
                this.x + this.hitbox_left, this.y + this.hitbox_top, this.x + this.hitbox_right, this.y + this.hitbox_bottom,
                target.x + target.hitbox_left, target.y + target.hitbox_top, target.x + target.hitbox_right, target.y + target.hitbox_bottom);

            if (touching)
            {
                this.is_chasing = false;
                game.combat = new Combat(target, this);
            }
        }
    }

    draw()
    {
        // Atordoado depois de uma fuga: pisca semitransparente
        const alpha = (this.stun_timer > 0 && Math.floor(this.stun_timer / 8) % 2 === 0) ? 0.4 : 1;
        draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y, 1, 1, 0, c_white, alpha);

        // "!" acima da cabeça quando avista o player
        if (this.alert_timer > 0)
        {
            const alert_y = this.y - 34 - Math.min(40 - this.alert_timer, 6);
            draw_set_halign(fa_center);
            draw_set_valign(fa_bottom);
            draw_set_colour(c_black);
            draw_text(this.x + 1, alert_y + 1, '!');
            draw_set_colour(c_yellow);
            draw_text(this.x, alert_y, '!');
            draw_set_colour(c_white);
            draw_set_halign(fa_left);
            draw_set_valign(fa_top);
        }
    }
}
