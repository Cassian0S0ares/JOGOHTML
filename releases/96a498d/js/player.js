'use strict';
// Antivírus (obj_player): o jogador. Bárbaro nível 3 (D&D 5e), Caminho do Berserker

class Player extends Instance
{
    static object = 'obj_player';

    create()
    {
        // Ficha
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

        // Firewall, o mago de fogo que luta junto (ficha em scr_firewall)
        this.ally = firewall_create();

        // Chegou por um portal: mantém a ficha do mundo anterior
        if (global.hero_state !== undefined)
        {
            this.hp = Math.min(global.hero_state.hp, this.get_hp_max());
            this.rage_uses = global.hero_state.rage_uses;
            this.exhaustion = global.hero_state.exhaustion;
            if (global.hero_state.ally !== undefined) firewall_load(this.ally, global.hero_state.ally);
        }

        // Caixa de colisão só dos pés, relativa à origem (base do sprite): a cabeça pode passar na frente das paredes
        this.hitbox_left = -10;
        this.hitbox_right = 10;
        this.hitbox_top = -14;
        this.hitbox_bottom = -1;

        this.move_speed = 3;
        this.anim_speed = 0.15;
        this.anim_frame = 0;
        this.is_moving = false;

        this.sprite_index = 'spr_senatir_down';
        this.image_index = 0;

        // Ampliação uniforme: preserva as proporções e a origem nos pés
        this.image_xscale = 1.3;
        this.image_yscale = 1.3;
        this.depth = -this.y;

        // Tiles da camada "Tiles_Walls" bloqueiam o movimento
        this.tilemap_walls = layer_tilemap('Tiles_Walls');

        // Cena: alguém (o Firewall na traição) está levando o antivírus; o jogador não controla e nada encosta nele
        this.cutscene = false;

        // Leitura de placas e computadores: alcance e o que está ao alcance agora
        this.read_range = 72;
        this.readable_prop = noone;
        this.usable_computer = noone;
        this.nearby_portal = noone;

        // Frames sem novos encontros depois de um combate
        this.encounter_cooldown = 0;
        this.rest_message = '';
        this.rest_message_timer = 0;

        // Descanso longo: 5 segundos sentado na fogueira (com o Firewall, se ele estiver no time)
        this.rest_duration = 5 * 60;
        this.rest_timer = 0;

        // O Firewall já está no time: vem junto para esta room e segue o antivírus pelo mapa
        if (firewall_in_party() && !instance_exists('obj_firewall'))
        {
            instance_create(FirewallNpc, this.x, this.y);
        }

        // Clarão sumindo ao chegar por um portal, e a fala de chegada
        this.arrival_fade = 0;
        this.arrival_dialogue = false;
        if (global.arrived_by_portal === true)
        {
            global.arrived_by_portal = false;
            this.arrival_fade = 1;
            this.arrival_dialogue = true;

            // Chegar num mundo novo vale um descanso longo; a ficha descansada é a que volta se a room reiniciar
            this.long_rest();
            global.hero_state = { hp: this.hp, rage_uses: this.rage_uses, exhaustion: this.exhaustion, ally: firewall_save(this.ally) };
        }

        // O DDoS já foi derrotado (ex.: a room reiniciou depois de uma derrota): o portal continua aberto
        if (game.room === 'Room1' && global.boss_ddos_defeated === true && !instance_exists('obj_portal'))
        {
            instance_create(Portal, BOSS_DDOS_X, BOSS_DDOS_Y);
        }
    }

    /// Descanso longo: recupera PV e Fúrias, reduz 1 nível de exaustão e restaura as magias e poções do Firewall
    long_rest()
    {
        this.exhaustion = Math.max(0, this.exhaustion - 1);
        this.hp = this.get_hp_max();
        this.rage_uses = this.rage_uses_max;
        firewall_long_rest(this.ally);
    }

    get_hp_max() { return (this.exhaustion >= 4) ? Math.floor(this.hp_max_base / 2) : this.hp_max_base; }

    is_blocked(x, y)
    {
        return tilemap_rect_blocked(this.tilemap_walls, x + this.hitbox_left, y + this.hitbox_top, x + this.hitbox_right, y + this.hitbox_bottom);
    }

    step()
    {
        const in_combat = instance_exists('obj_combat');

        // Chegada por portal: o clarão some e depois vem a fala
        if (this.arrival_fade > 0)
        {
            this.arrival_fade = Math.max(0, this.arrival_fade - 1 / 50);
            return;
        }
        if (this.arrival_dialogue)
        {
            this.arrival_dialogue = false;
            dialogue_start(world_arrival_lines(game.room));
        }

        // O mapa congela durante o combate, durante as falas e ao atravessar um portal
        if (in_combat) return;

        // Tecla 7 (fileira de cima ou teclado numérico): liga e desliga o modo paz (teste)
        if (keyboard_check_pressed(ord('7')) || keyboard_check_pressed(vk_numpad7))
        {
            global.peace_mode = !debug_peace();
            this.rest_message = debug_peace() ? 'Modo paz LIGADO: inimigos comuns te ignoram, chefes não (7 desliga).' : 'Modo paz desligado.';
            this.rest_message_timer = 150;
        }
        if (dialogue_is_active()) return;
        if (this.cutscene) return;
        if (instances_of('obj_portal').some((portal) => portal.entering)) return;

        if (this.encounter_cooldown > 0) this.encounter_cooldown -= 1;
        if (this.rest_message_timer > 0) this.rest_message_timer -= 1;

        // Sentado na fogueira: ninguém anda até o descanso acabar
        if (this.rest_timer > 0)
        {
            this.rest_timer -= 1;
            return;
        }

        // Descanso longo: recupera PV e Fúrias e reduz 1 nível de exaustão
        if (keyboard_check_pressed(ord('R')))
        {
            const in_danger = instances_of('obj_slime').some((slime) => slime.is_chasing);

            if (in_danger)
            {
                this.rest_message = 'Não dá para descansar com um inimigo te perseguindo!';
            }
            else
            {
                this.long_rest();
                this.rest_message = firewall_in_party() ? 'Descanso longo: PV, Fúrias e magias do Firewall restaurados.' : 'Descanso longo: PV e Fúrias restaurados.';
                this.rest_timer = this.rest_duration;
                this.anim_frame = 0;
                this.image_index = 0;
            }
            this.rest_message_timer = 150 + this.rest_timer;
        }

        // Placa mais próxima dentro do alcance
        this.readable_prop = noone;
        let best_distance = this.read_range;
        for (const prop of instances_of('obj_prop'))
        {
            if (prop.read_lines === undefined) continue;

            const distance = point_distance(prop.x, prop.y, this.x, this.y);
            if (distance < best_distance)
            {
                best_distance = distance;
                this.readable_prop = prop;
            }
        }

        // Computador mais próximo, se estiver mais perto que a placa
        this.usable_computer = noone;
        for (const computer of instances_of('obj_computer'))
        {
            const distance = point_distance(computer.x, computer.y, this.x, this.y);
            if (distance < best_distance)
            {
                best_distance = distance;
                this.usable_computer = computer;
                this.readable_prop = noone;
            }
        }

        const pressed = keyboard_check_pressed(ord('E')) || keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space);

        if (this.readable_prop !== noone)
        {
            const clicked = mouse_check_button_pressed() && position_meeting(mouse_x_room(), mouse_y_room(), this.readable_prop);

            if (pressed || clicked)
            {
                dialogue_start(this.readable_prop.read_lines);
                return;
            }
        }

        if (this.usable_computer !== noone)
        {
            const clicked_computer = mouse_check_button_pressed() && position_meeting(mouse_x_room(), mouse_y_room(), this.usable_computer);

            if (pressed || clicked_computer)
            {
                terminal_start(this.usable_computer);
                return;
            }
        }

        // Portal: E perto dele ou clique nele (de qualquer distância)
        this.nearby_portal = noone;
        const portal = instance_nearest(this.x, this.y, 'obj_portal');
        if (portal !== noone && portal.appear >= 1)
        {
            if (point_distance(this.x, this.y, portal.x, portal.y) < this.read_range + 16) this.nearby_portal = portal;

            const portal_clicked = mouse_check_button_pressed() && position_meeting(mouse_x_room(), mouse_y_room(), portal);
            if ((this.nearby_portal !== noone && pressed) || portal_clicked)
            {
                portal.enter();
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

    /// Sprite (ou a cena da fogueira durante o descanso)
    draw()
    {
        if (this.rest_timer > 0)
        {
            // O Firewall só senta junto se estiver no time, seguindo o antivírus
            const with_firewall = instances_of('obj_firewall').some((firewall) => firewall.following);

            draw_sprite_ext('spr_antivirus_sentado', 0, this.x - 34, this.y - 2, this.image_xscale, this.image_yscale, 0, c_white, 1);
            if (with_firewall) draw_sprite_ext('spr_firewall_sentado', 0, this.x + 34, this.y - 2, this.image_xscale, this.image_yscale, 0, c_white, 1);

            const fire_frame = Math.floor((this.rest_duration - this.rest_timer) * sprite_get_speed('spr_fogueira') / 60) % sprite_get_number('spr_fogueira');
            draw_sprite('spr_fogueira', fire_frame, this.x, this.y + 6);
            return;
        }

        this.draw_self();
    }

    /// HUD do antivírus
    draw_gui()
    {
        if (instance_exists('obj_combat')) return;

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        // Linha do Firewall só depois que ele entra no time
        const has_ally = firewall_in_party();
        const hud_bottom = has_ally ? 118 : 96;

        ui_draw_panel(8, 8, 408, hud_bottom);

        draw_set_colour(c_aqua);
        draw_text(18, 14, this.char_name + ' - ' + this.char_class);

        ui_draw_bar(18, 40, 140, 12, this.hp, this.get_hp_max(), c_lime);
        draw_set_colour(c_white);
        draw_text(168, 36, 'PV ' + this.hp + '/' + this.get_hp_max() + '  CA ' + this.armor_class);

        draw_set_colour(c_orange);
        draw_text(18, 58, 'Fúrias ' + this.rage_uses + '/' + this.rage_uses_max);
        draw_set_colour((this.exhaustion > 0) ? c_red : c_white);
        draw_text(168, 58, 'Exaustão ' + this.exhaustion);

        if (has_ally)
        {
            const ally = this.ally;
            draw_set_colour(make_colour_rgb(255, 150, 60));
            draw_text(18, 76, ally.char_name + '  PV ' + ally.hp + '/' + ally.get_hp_max()
                + '  Magias ' + ally.slots_1 + '/' + ally.slots_1_max + ' ' + ally.slots_2 + '/' + ally.slots_2_max);
        }

        draw_set_colour(c_gray);
        draw_text(18, hud_bottom - 20, 'WASD/Setas: andar   R: descanso longo   E: interagir');

        // Lembrete enquanto o modo paz (tecla 7) estiver ligado
        if (debug_peace())
        {
            draw_set_halign(fa_right);
            ui_draw_text_shadow(GUI_W - 16, 14, 'MODO PAZ (7)', c_lime);
            draw_set_halign(fa_left);
        }

        if (this.rest_message_timer > 0)
        {
            draw_set_alpha(Math.min(1, this.rest_message_timer / 30));
            draw_set_colour(c_yellow);
            draw_text(18, hud_bottom + 8, this.rest_message);
            draw_set_alpha(1);
        }

        draw_set_colour(c_white);

        // Aviso flutuante em cima da placa que dá para ler
        if (this.readable_prop !== noone && !dialogue_is_active())
        {
            draw_set_halign(fa_center);
            ui_draw_text_shadow(this.readable_prop.x, this.readable_prop.y - 72, 'E: ler a placa', c_yellow);
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }

        // Aviso flutuante em cima do computador
        if (this.usable_computer !== noone && !dialogue_is_active())
        {
            const computer = this.usable_computer;
            draw_set_halign(fa_center);
            ui_draw_text_shadow(computer.x, computer.y - 64, computer.solved ? 'E: usar o computador (protegido)' : 'E: usar o computador', computer.solved ? c_lime : c_aqua);
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }

        // Aviso flutuante em cima do portal
        const portal = instance_nearest(this.x, this.y, 'obj_portal');
        if (portal !== noone && portal.appear >= 1 && !portal.entering && !dialogue_is_active())
        {
            const portal_hint = (this.nearby_portal !== noone) ? 'E ou clique: entrar no portal' : 'Clique no portal para atravessar';
            draw_set_halign(fa_center);
            ui_draw_text_shadow(portal.x, portal.y - 130, portal_hint, make_colour_rgb(200, 140, 255));
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }

        // Clarão sumindo ao chegar por um portal
        if (this.arrival_fade > 0)
        {
            draw_set_alpha(this.arrival_fade);
            draw_set_colour(merge_colour(make_colour_rgb(170, 80, 255), c_white, this.arrival_fade));
            draw_rectangle(0, 0, GUI_W, GUI_H, false);
            draw_set_alpha(1);
            draw_set_colour(c_white);
        }
    }
}

OBJECTS.obj_player = Player;
