'use strict';
// Firewall no mapa (obj_firewall): espera na Room2 e, depois de entrar no time, segue o antivírus pelo mapa.
// Quando os computadores da Room2 ficam protegidos, chama o antivírus, leva ele até o meio do salão,
// agradece e vira o Cavalo de Troia (scr_trojan).

class FirewallNpc extends Instance
{
    static object = 'obj_firewall';

    create()
    {
        // Já mostrou quem é de verdade (ou já foi derrotado): o Firewall não existe mais
        if (trojan_betrayed() || trojan_defeated())
        {
            instance_destroy(this);
            return;
        }

        // Já no time e já existe outro (o antivírus cria um ao entrar numa room): fica só um
        if (firewall_in_party() && instance_number('obj_firewall') > 1)
        {
            instance_destroy(this);
            return;
        }

        // Mesmo tamanho do antivírus no mapa
        this.image_xscale = 1.3;
        this.image_yscale = 1.3;
        this.sprite_index = 'spr_firewall_left';
        this.depth = -this.y;

        this.talk_range = 72;
        this.player_near = false;
        this.greeted = false;      // já fez a apresentação (se o jogador sair da conversa, não repete tudo)

        // Saltinho animado de quem está ansioso por companhia
        this.anim_time = 0;
        this.hop = 0;

        // Seguindo: anda pelo mesmo caminho do antivírus, alguns passos atrás
        this.following = false;
        this.follow_delay = 16;    // pontos do rastro entre o antivírus e o Firewall (cada ponto é um quadro andando)
        this.trail = [];
        this.anim_frame = 0;
        this.anim_speed = 0.2;
        this.join_flash = 0;       // clarão laranja ao entrar no time

        // Antes de falar dá um pulinho; a conversa abre quando ele cai de volta no chão
        this.talk_hop_timer = 0;
        this.talk_hop_duration = 18;

        // Puxar papo: depois da fala de chegada ele mesmo vem até o antivírus e começa a conversa (uma vez só)
        this.approach_done = firewall_in_party();
        this.approaching = false;
        this.approach_wait = 30;          // respiro depois da fala de chegada
        this.approach_speed = 2;
        this.approach_distance = 40;      // para a esta distância e dá o pulinho

        // Traição: "" seguindo normal, "call" chamando, "walk" levando o antivírus, "talk" agradecendo, "transform" tirando a fantasia
        this.betrayal = '';
        this.betrayal_call_started = false;
        this.betrayal_talk_started = false;
        this.walk_points = [];
        this.walk_speed = 2;
        this.lead_trail = [];      // caminho do Firewall; o antivírus vem atrás, lead_delay passos depois
        this.lead_delay = 16;
        this.transform_timer = 0;
        this.transform_duration = 100;

        // Chegou numa room já no time: aparece ao lado do antivírus
        if (firewall_in_party())
        {
            const player = instance_nearest(this.x, this.y, 'obj_player');
            if (player !== noone)
            {
                this.x = player.x;
                this.y = player.y;
                // Um passo para trás do antivírus, se o chão deixar
                const walls = layer_tilemap('Tiles_Walls');
                if (walls === -1 || !tilemap_rect_blocked(walls, this.x - 40, this.y - 14, this.x - 20, this.y - 1)) this.x -= 30;
                this.start_following(player);
            }
        }
    }

    talk()
    {
        if (this.talk_hop_timer > 0) return;
        this.talk_hop_timer = this.talk_hop_duration;
    }

    open_dialogue()
    {
        if (dialogue_start(firewall_recruit_lines(this.greeted)) !== noone) this.greeted = true;
        // Se veio puxar papo, devolve o controle ao antivírus quando a conversa abre
        for (const player of instances_of('obj_player')) player.cutscene = false;
    }

    start_betrayal(player)
    {
        this.following = false;
        this.trail = [];
        this.betrayal = 'call';
        this.betrayal_call_started = false;
        player.cutscene = true;
    }

    /// Caminho pelos corredores até o meio do salão (grade de tiles da camada de colisão)
    build_walk_path(player)
    {
        // A origem fica nos pés: a célula de verdade é a de cima
        const path = grid_path(layer_tilemap('Tiles_Walls'), this.x, this.y - 8, TROJAN_X, TROJAN_Y - 8);
        this.walk_points = (path ?? []).map((point) => ({ x: point.x, y: point.y + 8 }));
        this.walk_points.push({ x: TROJAN_X, y: TROJAN_Y });

        // O antivírus primeiro anda até onde o Firewall está, depois segue o mesmo caminho dele
        this.lead_trail = [];
        const steps = Math.max(1, Math.ceil(point_distance(player.x, player.y, this.x, this.y) / this.walk_speed));
        for (let i = 1; i <= steps; i++)
        {
            this.lead_trail.push({ x: lerp(player.x, this.x, i / steps), y: lerp(player.y, this.y, i / steps) });
        }
    }

    /// Anda com o antivírus até o próximo ponto do rastro (sem controle do jogador)
    lead_player(player)
    {
        const previous_x = player.x;
        const previous_y = player.y;
        while (this.lead_trail.length > this.lead_delay)
        {
            player.x = this.lead_trail[0].x;
            player.y = this.lead_trail[0].y;
            this.lead_trail.shift();
        }

        const move_x = player.x - previous_x;
        const move_y = player.y - previous_y;
        if (move_x !== 0 || move_y !== 0)
        {
            if (Math.abs(move_x) >= Math.abs(move_y)) player.sprite_index = (move_x > 0) ? 'spr_senatir_right' : 'spr_senatir_left';
            else player.sprite_index = (move_y > 0) ? 'spr_senatir_down' : 'spr_senatir_up';
            player.anim_frame += player.anim_speed;
            player.image_index = player.anim_frame;
        }
        else
        {
            player.anim_frame = 0;
            player.image_index = 0;
        }
        player.depth = -player.y;
        // Ninguém começa luta no meio da cena
        player.encounter_cooldown = Math.max(player.encounter_cooldown, 30);
    }

    /// Começa a seguir: o rastro inicial é uma linha reta de onde ele está até o antivírus
    start_following(player)
    {
        this.following = true;
        this.hop = 0;
        this.trail = [];
        for (let i = 0; i < this.follow_delay; i++)
        {
            const t = i / this.follow_delay;
            this.trail.push({ x: lerp(this.x, player.x, t), y: lerp(this.y, player.y, t) });
        }
    }

    /// Vira para onde andou (prioriza o eixo horizontal, igual ao antivírus)
    face_movement(move_x, move_y)
    {
        if (Math.abs(move_x) >= Math.abs(move_y)) return (move_x > 0) ? 'spr_firewall_right' : 'spr_firewall_left';
        return (move_y > 0) ? 'spr_firewall_down' : 'spr_firewall_up';
    }

    step()
    {
        this.depth = -this.y;
        this.join_flash = Math.max(0, this.join_flash - 1);

        // O mapa congela durante o combate, durante as falas e durante o descanso na fogueira
        if (instance_exists('obj_combat') || dialogue_is_active() || world_resting())
        {
            this.player_near = false;
            return;
        }

        const player = instance_nearest(this.x, this.y, 'obj_player');
        if (player === noone) return;

        // Traição: chama o antivírus, leva ele até o meio do salão, agradece e vira o Cavalo de Troia
        if (this.betrayal === '' && this.following && trojan_should_betray()) this.start_betrayal(player);

        if (this.betrayal !== '')
        {
            // Ninguém começa luta com o antivírus no meio da cena
            player.encounter_cooldown = Math.max(player.encounter_cooldown, 30);

            switch (this.betrayal)
            {
                case 'call':
                    // O Step para enquanto a fala está aberta: voltar aqui depois de começar é sinal de que ela acabou
                    if (!this.betrayal_call_started) this.betrayal_call_started = (dialogue_start(trojan_call_lines()) !== noone);
                    else
                    {
                        this.build_walk_path(player);
                        this.betrayal = 'walk';
                    }
                    break;

                case 'walk':
                {
                    const previous_x = this.x;
                    const previous_y = this.y;
                    let budget = this.walk_speed;
                    while (budget > 0 && this.walk_points.length > 0)
                    {
                        const point = this.walk_points[0];
                        const distance = point_distance(this.x, this.y, point.x, point.y);
                        if (distance <= budget)
                        {
                            this.x = point.x;
                            this.y = point.y;
                            budget -= distance;
                            this.walk_points.shift();
                        }
                        else
                        {
                            this.x += (point.x - this.x) / distance * budget;
                            this.y += (point.y - this.y) / distance * budget;
                            budget = 0;
                        }
                    }

                    const move_x = this.x - previous_x;
                    const move_y = this.y - previous_y;
                    if (move_x !== 0 || move_y !== 0) this.lead_trail.push({ x: this.x, y: this.y });
                    this.lead_player(player);

                    if (move_x !== 0 || move_y !== 0)
                    {
                        this.sprite_index = this.face_movement(move_x, move_y);
                        this.anim_frame += this.anim_speed;
                        this.image_index = this.anim_frame % sprite_get_number(this.sprite_index);
                    }

                    // Chegou: vira para o antivírus e começa a agradecer
                    if (this.walk_points.length === 0)
                    {
                        this.sprite_index = (player.y > this.y) ? 'spr_firewall_down' : 'spr_firewall_up';
                        this.image_index = 0;
                        this.betrayal = 'talk';
                    }
                    break;
                }

                case 'talk':
                    // O Step para enquanto a fala está aberta: voltar aqui depois de começar é sinal de que ela acabou
                    if (!this.betrayal_talk_started) this.betrayal_talk_started = (dialogue_start(trojan_betrayal_lines()) !== noone);
                    else
                    {
                        this.betrayal = 'transform';
                        this.transform_timer = 0;
                    }
                    break;

                case 'transform':
                    this.transform_timer += 1;
                    if (this.transform_timer >= this.transform_duration)
                    {
                        const boss = trojan_transform(this.x, this.y);
                        player.cutscene = false;
                        instance_create(Combat, 0, 0, { hero: player, foe: boss });
                        instance_destroy(this);
                    }
                    break;
            }
            return;
        }

        // Acabou de aceitar entrar no time: clarão de fogo e começa a seguir
        if (firewall_in_party() && !this.following)
        {
            this.join_flash = 30;
            this.start_following(player);
        }

        if (this.following)
        {
            // Guarda um ponto do rastro a cada quadro em que o antivírus anda
            const last = this.trail[this.trail.length - 1];
            if (last.x !== player.x || last.y !== player.y) this.trail.push({ x: player.x, y: player.y });

            // Anda até o ponto que ficou follow_delay passos para trás
            const previous_x = this.x;
            const previous_y = this.y;
            while (this.trail.length > this.follow_delay)
            {
                this.x = this.trail[0].x;
                this.y = this.trail[0].y;
                this.trail.shift();
            }

            const move_x = this.x - previous_x;
            const move_y = this.y - previous_y;
            if (move_x !== 0 || move_y !== 0)
            {
                const sprite = this.face_movement(move_x, move_y);
                if (this.sprite_index !== sprite)
                {
                    this.sprite_index = sprite;
                    this.anim_frame = 0;
                }
                this.anim_frame += this.anim_speed;
                this.image_index = this.anim_frame % sprite_get_number(this.sprite_index);
            }
            else
            {
                this.anim_frame = 0;
                this.image_index = 0;
            }
            return;
        }

        this.anim_time += 1;

        // Puxar papo: espera o clarão do portal e a fala de chegada acabarem, vem até o antivírus e começa a conversa
        if (!this.approach_done && player.arrival_fade <= 0 && !player.arrival_dialogue && this.talk_hop_timer <= 0)
        {
            if (!this.approaching)
            {
                this.approach_wait -= 1;
                if (this.approach_wait <= 0)
                {
                    this.approaching = true;
                    player.cutscene = true;
                }
            }

            if (this.approaching)
            {
                const distance = point_distance(this.x, this.y, player.x, player.y);
                const walls = layer_tilemap('Tiles_Walls');
                let step_x = 0;
                let step_y = 0;
                if (distance > this.approach_distance)
                {
                    const speed = Math.min(this.approach_speed, distance - this.approach_distance);
                    step_x = (player.x - this.x) / distance * speed;
                    step_y = (player.y - this.y) / distance * speed;
                }

                // Chegou perto (ou bateu numa parede): pulinho e conversa
                const blocked = (walls !== -1) && tilemap_rect_blocked(walls, this.x + step_x - 10, this.y + step_y - 14, this.x + step_x + 10, this.y + step_y - 1);
                if ((step_x === 0 && step_y === 0) || blocked)
                {
                    this.approaching = false;
                    this.approach_done = true;
                    this.sprite_index = (player.x < this.x) ? 'spr_firewall_left' : 'spr_firewall_right';
                    this.image_index = 0;
                    player.sprite_index = (this.x < player.x) ? 'spr_senatir_left' : 'spr_senatir_right';
                    this.talk();
                    return;
                }

                this.x += step_x;
                this.y += step_y;
                this.sprite_index = this.face_movement(step_x, step_y);
                this.anim_frame += this.anim_speed;
                this.image_index = this.anim_frame % sprite_get_number(this.sprite_index);
                this.hop = 0;
                return;
            }
        }

        // Pulinho antes de falar: o mapa segue normal, e no fim do pulo a conversa abre
        if (this.talk_hop_timer > 0)
        {
            this.talk_hop_timer -= 1;
            this.hop = Math.sin((1 - this.talk_hop_timer / this.talk_hop_duration) * Math.PI) * 12;
            if (this.talk_hop_timer <= 0)
            {
                this.hop = 0;
                this.open_dialogue();
            }
            return;
        }

        // Sempre de frente para o antivírus
        this.sprite_index = (player.x < this.x) ? 'spr_firewall_left' : 'spr_firewall_right';
        if (Math.abs(player.x - this.x) < 12) this.sprite_index = (player.y > this.y) ? 'spr_firewall_down' : 'spr_firewall_up';
        this.image_index = 0;

        // De tempos em tempos dá dois pulinhos de empolgação
        const cycle = this.anim_time % 150;
        this.hop = (cycle < 24) ? Math.abs(Math.sin(cycle / 24 * Math.PI * 2)) * 6 : 0;

        this.player_near = point_distance(this.x, this.y, player.x, player.y) < this.talk_range;

        const pressed = keyboard_check_pressed(ord('E')) || keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space);
        const clicked = mouse_check_button_pressed() && position_meeting(mouse_x_room(), mouse_y_room(), this);

        if ((this.player_near && pressed) || clicked) this.talk();
    }

    /// Firewall com o pulinho; ao entrar no time dá um clarão laranja; na traição vira o cavalo
    draw()
    {
        // No descanso ele está sentado na fogueira (desenhada pelo antivírus)
        if (this.following && world_resting()) return;

        if (this.betrayal === 'transform')
        {
            // Pisca entre o Firewall e o cavalo, cada vez mais rápido, tremendo cada vez mais
            const progress = this.transform_timer / this.transform_duration;
            const period = Math.max(2, Math.round(16 * (1 - progress)));
            const show_horse = (progress > 0.85) || (Math.floor(this.transform_timer / period) % 2 === 1);
            const shake = irandom_range(-2, 2) * progress * 2;

            if (show_horse)
            {
                // Abre o compartimento: os soldados lá dentro aparecem
                const frame = Math.min(sprite_get_number('spr_cavalo_troia_summon') - 1, Math.floor(progress * 4));
                draw_sprite_ext('spr_cavalo_troia_summon', frame, this.x + shake, this.y, TROJAN_MAP_SCALE, TROJAN_MAP_SCALE, 0, merge_colour(c_fuchsia, c_white, progress), 1);
            }
            else
            {
                draw_sprite_ext(this.sprite_index, 0, this.x + shake, this.y, this.image_xscale, this.image_yscale, 0, merge_colour(c_white, c_fuchsia, progress), 1);
            }
            return;
        }

        const tint = (this.join_flash > 0) ? merge_colour(c_white, c_orange, this.join_flash / 30) : c_white;
        draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y - this.hop, this.image_xscale, this.image_yscale, 0, tint, this.image_alpha);
    }

    /// Aviso flutuante em cima do Firewall; clarão no fim da transformação
    draw_gui()
    {
        if (this.betrayal === 'transform')
        {
            const flash = clamp((this.transform_timer / this.transform_duration - 0.75) / 0.25, 0, 1);
            if (flash > 0)
            {
                draw_set_alpha(flash);
                draw_set_colour(merge_colour(c_fuchsia, c_white, flash));
                draw_rectangle(0, 0, GUI_W, GUI_H, false);
                draw_set_alpha(1);
                draw_set_colour(c_white);
            }
            return;
        }

        if (!this.player_near || dialogue_is_active() || instance_exists('obj_combat') || firewall_in_party()) return;

        draw_set_halign(fa_center);
        draw_set_valign(fa_top);
        ui_draw_text_shadow(this.x, this.y - 84, 'E: falar com o Firewall', make_colour_rgb(255, 150, 60));
        draw_set_halign(fa_left);
        draw_set_colour(c_white);
    }
}

OBJECTS.obj_firewall = FirewallNpc;
