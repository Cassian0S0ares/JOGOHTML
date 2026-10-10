'use strict';
// Inimigos do mapa: vírus (obj_slime), Vírus de Elite e Cavalo de Troia (filhos do obj_slime) e o chefe DDoS (obj_boss_ddos)

// ---------------------------------------------------------------- Vírus (obj_slime)

class Slime extends Instance
{
    static object = 'obj_slime';

    create()
    {
        // Ficha: baseada na Gosma Cinzenta (Gray Ooze, ND 1/2) de D&D 5e
        this.monster_name = 'Vírus';
        this.armor_class = 8;
        this.hp_max = 22;
        this.hp = this.hp_max;
        this.dexterity = 6;

        // Pseudópode: +3 para acertar, 1d6+1 contundente + 2d6 ácido
        this.attack_name = 'Pseudópode';
        this.attack_count = 1;                 // ataques por turno (Multiataque no Vírus de Elite)
        this.attack_bonus = 3;
        this.attack_dice_count = 1;
        this.attack_dice_sides = 6;
        this.attack_damage_type = 'contundente';
        this.pseudopod_bonus = 1;              // bônus no dano físico do ataque
        this.acid_dice_count = 2;
        this.acid_dice_sides = 6;

        // Cuspe Ácido (adição, recarga 5-6): TR de Destreza CD 11, 2d6 ácido, metade se passar
        this.spit_name = 'Cuspe Ácido';
        this.spit_damage_type = 'ácido';
        this.acid_spit_ready = true;
        this.acid_spit_dc = 11;
        this.acid_spit_dice_count = 2;

        // Aparência: no mapa e no combate (o golpe usa combat_sprite_attack, se houver)
        this.sprite_walk_down = 'spr_virus_down';
        this.sprite_walk_up = 'spr_virus_up';
        this.sprite_walk_left = 'spr_virus_left';
        this.sprite_walk_right = 'spr_virus_right';
        this.combat_sprite_idle = 'spr_virus_left';
        this.combat_sprite_attack = undefined;
        this.combat_scale = 4;
        this.combat_bar_offset = 100;          // altura das barras de vida acima do chão da arena

        // Modo paz (tecla 7) só vale para inimigos comuns: chefes continuam vindo, senão a história trava
        this.ignores_peace = false;

        // Depois que o player foge, fica atordoado e não persegue nem inicia combate
        this.stun_timer = 0;

        // Derrotado: dá a aulinha da sala onde nasceu e some quando a fala fecha
        this.lesson_topic = quiz_topic_at(this.x, this.y);
        this.is_dying = false;
        this.lesson_started = false;
        this.fade_timer = 0;

        this.move_speed = 1;
        this.anim_speed = 0.12;
        this.anim_frame = random(4);
        this.sprite_index = this.sprite_walk_down;
        this.image_xscale = 1;

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

        // Tiles da camada "Tiles_Walls" bloqueiam o movimento
        this.tilemap_walls = layer_tilemap('Tiles_Walls');

        // Caixa de colisão do corpo inteiro (parte visível do sprite), relativa à origem (base do sprite)
        this.hitbox_left = -14;
        this.hitbox_right = 13;
        this.hitbox_top = -18;
        this.hitbox_bottom = -1;

        this.depth = -this.y;
    }

    /// Dormente: não anda nem ataca (o Vírus de Elite espera o Firewall entrar no time)
    is_dormant() { return false; }

    get_lesson() { return quiz_get_lesson(this.lesson_topic); }

    is_blocked(x, y)
    {
        return tilemap_rect_blocked(this.tilemap_walls, x + this.hitbox_left, y + this.hitbox_top, x + this.hitbox_right, y + this.hitbox_bottom);
    }

    step()
    {
        // O mapa congela durante o combate
        if (instance_exists('obj_combat')) return;

        // Descanso na fogueira: os inimigos somem por 5 segundos
        if (world_resting()) return;

        // Derrotado: espera a aulinha acabar e some piscando
        if (this.is_dying)
        {
            this.image_index = 0;
            if (dialogue_is_active()) return;

            // A fala pode ter sido recusada (outra tela aberta): tenta de novo
            if (!this.lesson_started)
            {
                this.lesson_started = (dialogue_start(this.get_lesson()) !== noone);
                return;
            }

            this.fade_timer += 1;
            if (this.fade_timer >= 40) instance_destroy(this);
            return;
        }

        if (dialogue_is_active()) return;

        // Dormente: fica parado "respirando", sem perseguir nem iniciar combate
        if (this.is_dormant())
        {
            this.is_chasing = false;
            this.anim_frame = (this.anim_frame + this.anim_speed * 0.4) % 4;
            this.image_index = this.anim_frame;
            this.depth = -this.y;
            return;
        }

        const previous_x = this.x;
        const previous_y = this.y;

        if (this.stun_timer > 0) this.stun_timer -= 1;

        const target = instance_nearest(this.x, this.y, 'obj_player');
        const target_distance = (target !== noone) ? point_distance(this.x, this.y, target.x, target.y) : Infinity;

        // Modo paz (tecla 7): inimigos comuns não perseguem
        const peace = debug_peace() && !this.ignores_peace;
        if (peace && this.is_chasing)
        {
            this.is_chasing = false;
            this.is_moving = false;
            this.alert_timer = 0;
            this.state_timer = irandom_range(this.idle_time_min, this.idle_time_max);
        }

        if (!peace && !this.is_chasing && this.stun_timer <= 0 && target_distance < this.chase_start_distance)
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
            if (Math.abs(actual_x) >= Math.abs(actual_y)) sprite = (actual_x > 0) ? this.sprite_walk_right : this.sprite_walk_left;
            else sprite = (actual_y > 0) ? this.sprite_walk_down : this.sprite_walk_up;

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
        if (target !== noone && !peace && this.stun_timer <= 0 && target.encounter_cooldown <= 0)
        {
            const touching = rectangles_overlap(
                this.x + this.hitbox_left, this.y + this.hitbox_top, this.x + this.hitbox_right, this.y + this.hitbox_bottom,
                target.x + target.hitbox_left, target.y + target.hitbox_top, target.x + target.hitbox_right, target.y + target.hitbox_bottom);

            if (touching)
            {
                this.is_chasing = false;
                instance_create(Combat, 0, 0, { hero: target, foe: this });
            }
        }
    }

    draw()
    {
        // Descanso na fogueira: os inimigos somem
        if (world_resting()) return;

        // Atordoado depois de uma fuga: pisca semitransparente
        let alpha = (this.stun_timer > 0 && Math.floor(this.stun_timer / 8) % 2 === 0) ? 0.4 : 1;

        // Derrotado: pisca e vai sumindo depois da aulinha
        if (this.is_dying && this.fade_timer > 0) alpha = (Math.floor(this.fade_timer / 4) % 2 === 0) ? 1 - this.fade_timer / 40 : 0.2;
        draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y, this.image_xscale, this.image_yscale, this.image_angle, this.image_blend, alpha);

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

// ---------------------------------------------------------------- Vírus de Elite (obj_virus_elite)

/// Mesma IA e mesmo combate do vírus, ficha mais forte. Um em cada sala da Room2.
class VirusElite extends Slime
{
    static object = 'obj_virus_elite';

    create()
    {
        super.create();

        // Ficha: Vírus de Elite (ND 2), forma evoluída do vírus com carapaça e garras de cristal
        this.monster_name = 'Vírus de Elite';
        this.armor_class = 13;                 // carapaça blindada
        this.hp_max = 42;                      // 5d10+15
        this.hp = this.hp_max;
        this.dexterity = 12;

        // Multiataque: duas Garras Cristalinas, +5 para acertar, 1d8+3 cortante + 1d4 ácido cada
        this.attack_name = 'Garra Cristalina';
        this.attack_count = 2;
        this.attack_bonus = 5;
        this.attack_dice_count = 1;
        this.attack_dice_sides = 8;
        this.attack_damage_type = 'cortante';
        this.pseudopod_bonus = 3;
        this.acid_dice_count = 1;
        this.acid_dice_sides = 4;

        // Cuspe Corrosivo (recarga 5-6): TR de Destreza CD 13, 3d6 ácido, metade se passar
        this.spit_name = 'Cuspe Corrosivo';
        this.acid_spit_ready = true;
        this.acid_spit_dc = 13;
        this.acid_spit_dice_count = 3;

        this.sprite_walk_down = 'spr_virus_elite_down';
        this.sprite_walk_up = 'spr_virus_elite_up';
        this.sprite_walk_left = 'spr_virus_elite_left';
        this.sprite_walk_right = 'spr_virus_elite_right';
        this.combat_sprite_idle = 'spr_virus_elite_left';
        this.combat_sprite_attack = 'spr_virus_elite_combat_claw';
        this.combat_bar_offset = 160;
        this.sprite_index = this.sprite_walk_down;

        // Mais pesado: anda devagar, mas enxerga de mais longe
        this.move_speed = 0.8;
        this.chase_speed = 1.6;
        this.chase_start_distance = 160;
        this.chase_stop_distance = 260;

        // Corpo maior que o do vírus comum
        this.hitbox_left = -16;
        this.hitbox_right = 15;
        this.hitbox_top = -24;
        this.hitbox_bottom = -1;
    }

    /// Só acorda quando o Firewall entra no time: o antivírus não enfrenta um desses sozinho
    is_dormant() { return !firewall_in_party() && !trojan_betrayed(); }

    get_lesson() { return virus_elite_lesson(this.xstart, this.ystart); }
}

// ---------------------------------------------------------------- Cavalo de Troia (obj_boss_trojan)

/// Chefe final da Room2: anda, persegue e entra em combate igual ao vírus
class TrojanBoss extends Slime
{
    static object = 'obj_boss_trojan';

    create()
    {
        super.create();

        // Ficha: Cavalo de Troia (ND 3), um cavalo de madeira cheio de soldados
        this.monster_name = 'Cavalo de Troia';
        this.armor_class = 14;                 // tábuas de carvalho com cintas de ferro
        this.hp_max = 60;
        this.hp = this.hp_max;
        this.dexterity = 8;

        // Investida: +6 para acertar, 2d6+3 contundente
        this.attack_name = 'Investida';
        this.attack_count = 1;
        this.attack_bonus = 6;
        this.attack_dice_count = 2;
        this.attack_dice_sides = 6;
        this.attack_damage_type = 'contundente';
        this.pseudopod_bonus = 3;
        this.acid_dice_count = 0;              // sem dano extra

        // Chuva de Lascas (recarga 5-6): TR de Destreza CD 13, 3d6 perfurante, metade se passar
        this.spit_name = 'Chuva de Lascas';
        this.spit_damage_type = 'perfurante';
        this.acid_spit_ready = false;          // começa recarregando: a primeira rodada é só a investida
        this.acid_spit_dc = 13;
        this.acid_spit_dice_count = 3;

        this.sprite_walk_down = 'spr_cavalo_troia_idle';
        this.sprite_walk_up = 'spr_cavalo_troia_idle';
        this.sprite_walk_left = 'spr_cavalo_troia_idle';
        this.sprite_walk_right = 'spr_cavalo_troia_idle';
        this.sprite_index = 'spr_cavalo_troia_idle';
        this.combat_sprite_idle = 'spr_cavalo_troia_idle';
        this.combat_sprite_attack = 'spr_cavalo_troia_charge';
        this.combat_scale = 2;
        this.combat_bar_offset = 185;

        this.image_xscale = TROJAN_MAP_SCALE;
        this.image_yscale = TROJAN_MAP_SCALE;

        // Pesado: anda devagar, mas não desiste de você
        this.move_speed = 0.6;
        this.chase_speed = 1.2;
        this.chase_start_distance = 220;
        this.chase_stop_distance = 400;

        // Base do cavalo (para as paredes) e corpo
        this.hitbox_left = -28;
        this.hitbox_right = 28;
        this.hitbox_top = -20;
        this.hitbox_bottom = -1;

        // Derrotado: as tábuas desabam enquanto ele dá a última aula
        this.defeat_frame = 0;

        this.ignores_peace = true;
    }

    is_dormant() { return false; }

    get_lesson()
    {
        global.trojan_beaten = true;
        return trojan_defeat_lines();
    }

    step()
    {
        super.step();

        if (this.destroyed) return;
        if (world_resting()) return;

        if (this.is_dying)
        {
            this.sprite_index = 'spr_cavalo_troia_defeat';
            this.defeat_frame = Math.min(sprite_get_number('spr_cavalo_troia_defeat') - 1, this.defeat_frame + 0.08);
            this.image_index = this.defeat_frame;
            return;
        }

        // O sprite olha para a esquerda: andando para a direita, espelha
        if (this.x > this.xprevious) this.image_xscale = -TROJAN_MAP_SCALE;
        else if (this.x < this.xprevious) this.image_xscale = TROJAN_MAP_SCALE;
    }
}

// ---------------------------------------------------------------- Chefe DDoS (obj_boss_ddos)

/// Pudim Negro de D&D 5e, adaptado: surge quando os quatro computadores da Room1 estão protegidos
class BossDdos extends Instance
{
    static object = 'obj_boss_ddos';

    create()
    {
        // Ficha: baseada no Pudim Negro (Black Pudding, ND 4)
        this.monster_name = 'DDoS';
        this.armor_class = 7;
        this.hp_max = 64;
        this.hp = this.hp_max;
        this.dexterity = 5;

        // Pseudópode: +5 para acertar; o dano depende do tamanho do pedaço (ver boss_piece_tier)
        this.attack_bonus = 5;

        this.sprite_index = 'spr_ddos';

        // Despertar: aviso de presença ameaçadora, depois a fala de apresentação
        this.banner_timer = 200;
        this.banner_duration = this.banner_timer;
        this.appear = 0;
        this.intro_started = false;
        this.intro_done = false;

        // Depois de uma fuga fica atordoado; depois da derrota dá a última aulinha e some
        this.stun_timer = 0;
        this.is_dying = false;
        this.lesson_started = false;
        this.fade_timer = 0;

        this.anim_time = 0;
        this.creep_speed = 0.6;       // devagar, como um pudim
        this.chase_distance = 260;

        this.image_xscale = BOSS_DDOS_MAP_SCALE;
        this.image_yscale = BOSS_DDOS_MAP_SCALE;

        this.tilemap_walls = layer_tilemap('Tiles_Walls');

        // Pés (para as paredes) e corpo (para encostar no player), relativos à origem na base
        this.hitbox_left = -36;
        this.hitbox_right = 36;
        this.hitbox_top = -16;
        this.hitbox_bottom = -1;
        this.body_top = -64;

        this.depth = -this.y;
    }

    is_blocked(x, y)
    {
        return tilemap_rect_blocked(this.tilemap_walls, x + this.hitbox_left, y + this.hitbox_top, x + this.hitbox_right, y + this.hitbox_bottom);
    }

    step()
    {
        if (instance_exists('obj_combat')) return;
        if (world_resting()) return;

        this.anim_time += 1;

        // Animação: todos os frames menos o 3 (descarga elétrica, usado no ataque)
        const idle_frames = [0, 1, 2, 4, 5];
        this.image_index = idle_frames[Math.floor(this.anim_time / 10) % idle_frames.length];

        // Despertar
        if (!this.intro_done)
        {
            this.appear = Math.min(1, this.appear + 1 / 120);

            if (this.banner_timer > 0)
            {
                this.banner_timer -= 1;
                return;
            }

            if (dialogue_is_active()) return;

            if (!this.intro_started) this.intro_started = (dialogue_start(boss_ddos_intro_lines()) !== noone);
            else this.intro_done = true;
            return;
        }

        // Derrotado: última aulinha e some
        if (this.is_dying)
        {
            if (dialogue_is_active()) return;

            if (!this.lesson_started)
            {
                this.lesson_started = (dialogue_start(boss_ddos_defeat_lines()) !== noone);
                return;
            }

            this.fade_timer += 1;
            if (this.fade_timer >= 90)
            {
                // Onde o DDoS estava, abre o portal para o próximo mundo
                global.boss_ddos_defeated = true;
                instance_create(Portal, this.x, this.y);
                instance_destroy(this);
            }
            return;
        }

        if (dialogue_is_active()) return;

        if (this.stun_timer > 0) this.stun_timer -= 1;

        const target = instance_nearest(this.x, this.y, 'obj_player');
        if (target === noone) return;

        // Rasteja na direção do player quando ele está na sala
        const distance = point_distance(this.x, this.y, target.x, target.y);
        if (this.stun_timer <= 0 && distance < this.chase_distance && distance > 8)
        {
            const dir = point_direction(this.x, this.y, target.x, target.y);
            const move_x = lengthdir_x(this.creep_speed, dir);
            const move_y = lengthdir_y(this.creep_speed, dir);
            if (!this.is_blocked(this.x + move_x, this.y)) this.x += move_x;
            if (!this.is_blocked(this.x, this.y + move_y)) this.y += move_y;
        }

        this.depth = -this.y;

        // Encostou no player: começa a luta contra o chefe
        if (this.stun_timer <= 0 && target.encounter_cooldown <= 0)
        {
            const touching = rectangles_overlap(
                this.x + this.hitbox_left, this.y + this.body_top, this.x + this.hitbox_right, this.y + this.hitbox_bottom,
                target.x + target.hitbox_left, target.y + target.hitbox_top, target.x + target.hitbox_right, target.y + target.hitbox_bottom);

            if (touching) instance_create(Combat, 0, 0, { hero: target, foe: this });
        }
    }

    /// Sprite: surge aos poucos, pisca atordoado e some ao ser derrotado
    draw()
    {
        if (world_resting()) return;

        let alpha = this.appear;
        if (this.stun_timer > 0 && Math.floor(this.stun_timer / 8) % 2 === 0) alpha *= 0.4;
        if (this.is_dying && this.fade_timer > 0) alpha *= (Math.floor(this.fade_timer / 4) % 2 === 0) ? 1 - this.fade_timer / 90 : 0.2;

        // Respira devagar, como uma gosma
        const wobble = Math.sin(this.anim_time * 0.05) * 0.015;
        gpu_set_texfilter(true);
        draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y, this.image_xscale + wobble, this.image_yscale - wobble, 0, c_white, alpha);
        gpu_set_texfilter(false);
    }

    /// Aviso: "você sente uma presença ameaçadora"
    draw_gui()
    {
        if (this.banner_timer <= 0) return;

        const elapsed = this.banner_duration - this.banner_timer;
        const alpha = Math.min(1, elapsed / 30, this.banner_timer / 30);
        const pulse = 0.5 + 0.5 * Math.sin(elapsed * 0.12);

        // Bordas vermelhas pulsando
        draw_set_colour(make_colour_rgb(160, 0, 40));
        for (let i = 0; i < 6; i++)
        {
            draw_set_alpha(alpha * (0.10 + 0.12 * pulse) * (1 - i / 6));
            const inset = i * 14;
            draw_rectangle(inset, inset, GUI_W - inset, GUI_H - inset, true);
            draw_rectangle(inset + 1, inset + 1, GUI_W - inset - 1, GUI_H - inset - 1, true);
        }

        // Faixa escura com o texto
        draw_set_alpha(alpha * 0.75);
        draw_set_colour(c_black);
        draw_rectangle(0, GUI_H / 2 - 60, GUI_W, GUI_H / 2 + 60, false);
        draw_set_alpha(alpha);

        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);

        // Tremidinha no texto
        const shake_x = irandom_range(-1, 1) * pulse;
        const shake_y = irandom_range(-1, 1) * pulse;
        ui_draw_text_shadow(GUI_W / 2 + shake_x, GUI_H / 2 - 16 + shake_y, 'Você sente uma presença ameaçadora...', merge_colour(c_red, c_fuchsia, pulse), 2);
        ui_draw_text_shadow(GUI_W / 2, GUI_H / 2 + 28, 'Algo despertou na sala do meio, lá embaixo.', c_ltgray);

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
        draw_set_alpha(1);
        draw_set_colour(c_white);
    }
}

Object.assign(OBJECTS, { obj_slime: Slime, obj_virus_elite: VirusElite, obj_boss_trojan: TrojanBoss, obj_boss_ddos: BossDdos });
