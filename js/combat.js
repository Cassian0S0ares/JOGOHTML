'use strict';
// Combate por turnos (obj_combat): o Antivírus (Bárbaro 3 Berserker) e, depois que ele entra no time, o Firewall (Mago 3)
// contra o vírus, o Vírus de Elite, o chefe DDoS (enxame de pedaços) ou o Cavalo de Troia (rouba habilidades).

class Combat extends Instance
{
    static object = 'obj_combat';

    /// Recebe pelo instance_create: hero (o Player) e foe (o inimigo que encostou)
    create()
    {
        const hero = this.hero;
        const foe = this.foe;
        this.depth = -10000;

        // Música de combate em loop (a música do mapa é pausada pelo antivírus); os chefes finais têm a deles
        const is_final_boss = foe.is('obj_boss_ddos') || foe.is('obj_boss_trojan');
        this.combat_music_asset = is_final_boss ? 'snd_boss_music' : 'snd_combat_music';
        this.combat_music = audio_play_sound(this.combat_music_asset, true, 0.6);

        this.state = CombatState.intro;
        this.wait_timer = 10;
        this.round_number = 1;
        this.turn_order = [];
        this.turn_index = 0;
        this.foe_has_acted = false;

        this.log_entries = [];
        this.log_max_entries = 80;

        this.menu_items = [];
        this.menu_index = 0;
        this.mouse_last_x = device_mouse_x_to_gui();
        this.mouse_last_y = device_mouse_y_to_gui();

        // Fila de eventos: rolagens animadas, mensagens e dano acontecem em ordem, um depois do outro
        this.event_queue = [];

        // Condições do bárbaro que só existem durante o combate
        this.is_raging = false;
        this.is_frenzied = false;
        this.rage_rounds_left = 0;
        this.rage_started_this_turn = false;
        this.rage_sustained = false;   // atacou ou sofreu dano desde o fim do último turno
        this.reckless_selected = false;
        this.reckless_active = false;  // vantagem nos ataques de Força; inimigo tem vantagem contra você
        this.is_dodging = false;
        this.action_used = false;
        this.bonus_used = false;
        this.attacks_this_turn = 0;

        // Firewall (aliado): a ficha mora no antivírus; aqui fica só o que dura o combate
        // Antes de ele entrar no time (Room2), o antivírus luta sozinho
        this.ally = hero.ally;
        this.ally_in_party = firewall_in_party();
        this.ally_dodging = false;
        this.ally_buff = undefined;         // buff do ritmo esperando o próximo acerto de fogo
        this.ally_amulet_used = false;      // Amuleto de Salamandra: uma vez por combate
        this.foe_target = hero;             // quem o inimigo ataca neste turno (hero ou ally)

        // Chefe DDoS: o inimigo vira um enxame de pedaços (pieces), e o timing do ataque
        // decide quantos golpes você dá (perfeito 3, bom 2, fora do tempo 1), escolhendo o alvo de cada um
        this.is_boss = foe.is('obj_boss_ddos');
        this.pieces = this.is_boss ? [boss_piece_create(foe.hp)] : [];
        this.attacks_left = 0;
        this.attacks_total = 0;
        this.pending_source = '';
        this.pending_actor = hero;          // quem dá os golpes escolhidos no chefe (hero ou ally)
        this.pending_dice = undefined;      // dados de dano de cada raio do Firewall no chefe
        this.target_index = 0;

        // Chefe Cavalo de Troia: rouba habilidades do antivírus (scr_trojan) e às vezes usa contra você
        this.is_trojan = foe.is('obj_boss_trojan');
        this.stolen = [];                   // chaves das habilidades roubadas, da mais antiga para a mais nova
        this.trojan_turns = 0;
        this.trojan_raging = false;         // usando a Fúria roubada: +2 de dano e resistência ao seu machado
        this.trojan_reckless = false;       // usando o Ataque Imprudente roubado: vantagem dos dois lados até o próximo turno dele
        this.trojan_dodging = false;        // usando o Esquivar roubado: seus ataques com desvantagem até o próximo turno dele
        this.hero_armor_base = hero.armor_class;
        this.foe_armor_base = foe.armor_class;
        this.foe_damage_base = this.is_trojan ? foe.pseudopod_bonus : 0;   // o DDoS não tem esse campo
        this.foe_hatch = 0;                 // animação do compartimento abrindo (roubo)

        this.hero_colour = c_aqua;
        this.ally_colour = make_colour_rgb(255, 150, 60);
        this.foe_colour = make_colour_rgb(200, 140, 255);
        this.hit_colour = make_colour_rgb(255, 120, 120);

        // Animação
        this.anim_time = 0;
        this.hero_lunge = 0;
        this.ally_lunge = 0;
        this.foe_lunge = 0;
        this.hero_flash = 0;
        this.ally_flash = 0;
        this.foe_flash = 0;
        this.popups = [];

        this.roll_initiative();
    }

    // ------------------------------------------------------------ Registro e efeitos

    add_log(text, colour = c_white)
    {
        this.log_entries.push({ text, colour });
        if (this.log_entries.length > this.log_max_entries) this.log_entries.splice(0, 1);
    }

    add_popup(on_hero, text, colour, piece = undefined, on_ally = false)
    {
        this.popups.push({ on_hero, on_ally, text, colour, timer: 50, piece });
    }

    // ------------------------------------------------------------ Fila de eventos

    queue_log(text, colour = c_white) { this.event_queue.push({ type: 'log', text, colour }); }
    queue_popup(on_hero, text, colour) { this.event_queue.push({ type: 'popup', on_hero, on_ally: false, text, colour }); }
    queue_lunge(on_hero) { this.event_queue.push({ type: 'lunge', on_hero, on_ally: false }); }
    queue_damage(on_hero, amount, piece = undefined) { this.event_queue.push({ type: 'damage', on_hero, on_ally: false, amount, piece }); }

    /// Versões que aceitam o personagem do grupo (hero ou ally) em vez de true/false
    queue_popup_on(member, text, colour) { this.event_queue.push({ type: 'popup', on_hero: member === this.hero, on_ally: member === this.ally, text, colour }); }
    queue_lunge_on(member) { this.event_queue.push({ type: 'lunge', on_hero: member === this.hero, on_ally: member === this.ally }); }
    queue_damage_on(member, amount) { this.event_queue.push({ type: 'damage', on_hero: member === this.hero, on_ally: member === this.ally, amount, piece: undefined }); }
    queue_heal(member, amount) { this.event_queue.push({ type: 'heal', member, amount }); }

    /// Minijogo de ritmo do Firewall; quando termina, resolve_rhythm conjura a magia com o buff
    queue_rhythm(data) { this.event_queue.push(rhythm_event_create(data)); }

    queue_wait(frames) { this.event_queue.push({ type: 'wait', frames }); }
    queue_dice(dice_event) { this.event_queue.push(dice_event); }

    /// Minijogo de timing; quando termina, resolve_timing decide o que vem depois (rolagens, dano)
    queue_timing(kind, data) { this.event_queue.push(timing_event_create(kind, data)); }

    /// O que um minijogo gera (rolagens, dano) entra na frente do resto da fila
    resolve_in_front(resolve)
    {
        const rest = this.event_queue;
        this.event_queue = [];
        resolve();
        this.event_queue = this.event_queue.concat(rest);
    }

    /// Executa a fila. Retorna true enquanto houver algo em andamento (bloqueia menu e turnos).
    process_queue(skip_pressed)
    {
        while (this.event_queue.length > 0)
        {
            const event = this.event_queue[0];

            switch (event.type)
            {
                case 'dice':
                    if (event.timer === undefined)
                    {
                        dice_event_prepare(event);

                        // Som baixo dos dados rolando, com leve variação de tom para não cansar
                        audio_play_sound('snd_dice_roll', false, 0.3, random_range(0.92, 1.08));
                    }
                    event.timer += 1;
                    if (skip_pressed) dice_event_skip(event);
                    if (event.timer >= event.duration) this.event_queue.splice(0, 1);
                    return true;

                case 'timing':
                    if (event.timer === undefined) timing_event_prepare(event);
                    if (timing_event_update(event, skip_pressed))
                    {
                        this.event_queue.splice(0, 1);
                        this.resolve_in_front(() => this.resolve_timing(event));
                    }
                    return true;

                case 'rhythm':
                    if (event.timer === undefined) rhythm_event_prepare(event);
                    if (rhythm_event_update(event, skip_pressed))
                    {
                        this.event_queue.splice(0, 1);
                        this.resolve_in_front(() => this.resolve_rhythm(event));
                    }
                    return true;

                case 'hatch':
                    this.foe_hatch = 40;
                    break;

                case 'wait':
                    event.frames -= 1;
                    if (event.frames <= 0) this.event_queue.splice(0, 1);
                    return true;

                case 'log':
                    this.add_log(event.text, event.colour);
                    break;

                case 'popup':
                    this.add_popup(event.on_hero, event.text, event.colour, undefined, event.on_ally);
                    break;

                case 'lunge':
                    if (event.on_ally) this.ally_lunge = 20;
                    else if (event.on_hero) this.hero_lunge = 20;
                    else this.foe_lunge = 20;
                    break;

                case 'damage':
                    if (event.on_ally) this.damage_ally(event.amount);
                    else if (event.on_hero) this.damage_hero(event.amount);
                    else this.damage_foe(event.amount, event.piece);
                    break;

                case 'heal':
                {
                    const member = event.member;
                    member.hp = Math.min(member.get_hp_max(), member.hp + event.amount);
                    this.add_popup(member === this.hero, '+' + event.amount, c_lime, undefined, member === this.ally);
                    break;
                }
            }

            // finish_combat pode ter esvaziado a fila
            if (this.event_queue.length > 0 && this.event_queue[0] === event) this.event_queue.splice(0, 1);
        }

        return false;
    }

    current_event(type)
    {
        const event = this.event_queue[0];
        return (event !== undefined && event.type === type && event.timer !== undefined) ? event : undefined;
    }

    resolve_timing(event)
    {
        const texts = timing_result_text(event);
        this.queue_log('Timing: ' + texts[0] + ' (' + texts[1] + ')', (event.result === TimingResult.miss) ? c_ltgray : DICE_COLOUR_TIMING);

        switch (event.kind)
        {
            case 'attack':
                if (this.is_boss) this.boss_start_attacks(event.data.source, event.result);
                else this.hero_attack_roll(event.data.source, event.result);
                break;

            case 'defend':
                if (event.data.attack === 'flood') this.boss_flood_resolve(event.result);
                else if (event.data.attack === 'acid_spit') this.foe_acid_spit_resolve(event.result);
                else this.foe_pseudopod_resolve(event.result);
                break;
        }
    }

    /// Defesa no tempo certo reduz o dano final (depois de resistências e TR)
    apply_timing_defense(damage_event, damage, timing)
    {
        let reduced = damage;
        if (timing === TimingResult.perfect) reduced = Math.floor(damage / 2);
        else if (timing === TimingResult.good) reduced = Math.max(0, damage - TIMING_DEFEND_GOOD_BLOCK);

        if (reduced !== damage)
        {
            dice_event_add_modifier(damage_event, reduced - damage, (timing === TimingResult.perfect) ? 'Defesa perfeita' : 'Defesa');
        }
        return reduced;
    }

    // ------------------------------------------------------------ Layout (usado pelo Step e pelo Draw GUI)

    get_layout()
    {
        const w = GUI_W;
        const h = GUI_H;
        const margin = 16;
        const log_left = Math.floor(w * 0.62);
        const bottom_top = Math.floor(h * 0.52);
        const sheet_right = margin + 330;

        return {
            width: w,
            height: h,
            arena: { x1: margin, y1: margin, x2: log_left - 8, y2: bottom_top - 8 },
            log: { x1: log_left, y1: margin, x2: w - margin, y2: h - margin },
            sheet: { x1: margin, y1: bottom_top, x2: sheet_right, y2: h - margin },
            menu: { x1: sheet_right + 8, y1: bottom_top, x2: log_left - 8, y2: h - margin },
            line_height: 20,
            menu_line_height: 24,
            menu_first_y: bottom_top + 40,
        };
    }

    // ------------------------------------------------------------ Turnos

    roll_initiative()
    {
        const hero = this.hero;
        const foe = this.foe;
        const ally = this.ally;

        // Iniciativa: d20 + Destreza (exaustão 1+ dá desvantagem em testes de atributo)
        const hero_init_disadvantage = hero.exhaustion >= 1;
        const hero_init_bonus = ability_modifier(hero.dexterity);
        const hero_init = roll_d20(false, hero_init_disadvantage);
        const hero_init_total = hero_init.natural + hero_init_bonus;

        const foe_init_bonus = ability_modifier(foe.dexterity);
        const foe_init = roll_d20(false, false);
        const foe_init_total = foe_init.natural + foe_init_bonus;

        const ally_init_bonus = ability_modifier(ally.dexterity);
        const ally_init = roll_d20(false, false);
        const ally_init_total = ally_init.natural + ally_init_bonus;

        // Ordem pela iniciativa; empate: vence quem tem mais Destreza
        const order = [
            { who: hero, total: hero_init_total, dexterity: hero.dexterity },
            { who: foe, total: foe_init_total, dexterity: foe.dexterity },
        ];
        if (this.ally_in_party) order.push({ who: ally, total: ally_init_total, dexterity: ally.dexterity });
        order.sort((a, b) => (a.total !== b.total) ? b.total - a.total : b.dexterity - a.dexterity);
        this.turn_order = order.map((entry) => entry.who);

        const first = this.turn_order[0];
        const first_text = (first === hero) ? 'Você age primeiro!' : ((first === ally) ? 'O ' + ally.char_name + ' age primeiro!' : 'O ' + foe.monster_name + ' age primeiro!');
        const first_colour = (first === hero) ? this.hero_colour : ((first === ally) ? this.ally_colour : this.foe_colour);

        this.add_log(this.is_boss ? 'O ' + foe.monster_name + ' transborda pela sala! Rolando iniciativa...' : 'Um ' + foe.monster_name + ' ataca! Rolando iniciativa...', c_white);

        const hero_init_event = dice_event_create('Iniciativa: ' + hero.char_name, this.hero_colour);
        hero_init_event.mode_text = roll_mode_text(false, hero_init_disadvantage, '', 'Exaustão');
        hero_init_event.fast = true;
        dice_event_add_d20(hero_init_event, hero_init, DICE_COLOUR_HERO, DICE_TEXT_DARK);
        dice_event_add_modifier(hero_init_event, hero_init_bonus, 'Destreza');
        hero_init_event.total = hero_init_total;
        this.queue_dice(hero_init_event);
        this.queue_log('Você: ' + hero_init.text + format_modifier(hero_init_bonus) + ' = ' + hero_init_total, this.hero_colour);

        if (this.ally_in_party)
        {
            const ally_init_event = dice_event_create('Iniciativa: ' + ally.char_name, this.ally_colour);
            ally_init_event.fast = true;
            dice_event_add_d20(ally_init_event, ally_init, DICE_COLOUR_HERO, DICE_TEXT_DARK);
            dice_event_add_modifier(ally_init_event, ally_init_bonus, 'Destreza');
            ally_init_event.total = ally_init_total;
            this.queue_dice(ally_init_event);
            this.queue_log(ally.char_name + ': ' + ally_init.text + format_modifier(ally_init_bonus) + ' = ' + ally_init_total, this.ally_colour);
        }

        const foe_init_event = dice_event_create('Iniciativa: ' + foe.monster_name, this.foe_colour);
        foe_init_event.fast = true;
        dice_event_add_d20(foe_init_event, foe_init, DICE_COLOUR_FOE, c_white);
        dice_event_add_modifier(foe_init_event, foe_init_bonus, 'Destreza');
        foe_init_event.total = foe_init_total;
        foe_init_event.verdict = first_text;
        foe_init_event.verdict_colour = first_colour;
        this.queue_dice(foe_init_event);
        this.queue_log(foe.monster_name + ': ' + foe_init.text + format_modifier(foe_init_bonus) + ' = ' + foe_init_total, this.foe_colour);
    }

    begin_turn()
    {
        const current = this.turn_order[this.turn_index];

        if (current === this.hero)
        {
            this.state = CombatState.hero_turn;
            this.action_used = false;
            this.bonus_used = false;
            this.attacks_this_turn = 0;
            this.reckless_selected = false;
            this.rage_started_this_turn = false;
            this.menu_index = 0;

            // Efeitos que duram "até o início do seu próximo turno"
            this.reckless_active = false;
            this.is_dodging = false;

            this.add_log('-- Rodada ' + this.round_number + ': seu turno --', this.hero_colour);
        }
        else if (current === this.ally)
        {
            if (this.ally.hp <= 0)
            {
                this.add_log(this.ally.char_name + ' está caído e perde o turno.', c_gray);
                this.next_turn();
                return;
            }

            this.state = CombatState.ally_turn;
            this.action_used = false;
            this.bonus_used = false;
            this.menu_index = 0;
            this.ally_dodging = false;

            this.add_log('-- Rodada ' + this.round_number + ': turno do ' + this.ally.char_name + ' --', this.ally_colour);
        }
        else
        {
            this.state = CombatState.foe_turn;
            this.foe_has_acted = false;
            this.wait_timer = 30;
            this.add_log('-- Rodada ' + this.round_number + ': turno do ' + this.foe.monster_name + ' --', this.foe_colour);
        }
    }

    next_turn()
    {
        this.turn_index += 1;
        if (this.turn_index >= this.turn_order.length)
        {
            this.turn_index = 0;
            this.round_number += 1;
        }
        this.begin_turn();
    }

    hero_end_turn()
    {
        if (this.is_raging)
        {
            this.rage_rounds_left -= 1;

            if (this.rage_rounds_left <= 0) this.end_rage('A Fúria chega ao fim (1 minuto).');
            else if (!this.rage_sustained) this.end_rage('Você não atacou nem sofreu dano desde o último turno: a Fúria se apaga.');
        }
        this.rage_sustained = false;

        if (this.hero.exhaustion >= 6)
        {
            this.finish_combat(CombatState.defeat);
            return;
        }

        this.wait_timer = 20;
        this.next_turn();
    }

    ally_end_turn()
    {
        this.wait_timer = 20;
        this.next_turn();
    }

    end_current_turn()
    {
        if (this.state === CombatState.ally_turn) this.ally_end_turn();
        else this.hero_end_turn();
    }

    finish_combat(result)
    {
        this.event_queue = [];
        this.attacks_left = 0;

        if (this.is_raging) this.end_rage('A Fúria termina junto com o combate.');

        if (result !== CombatState.defeat && this.hero.exhaustion >= 6) result = CombatState.defeat;

        this.state = result;
        this.wait_timer = 30;

        switch (result)
        {
            case CombatState.victory:
                this.add_log('O ' + this.foe.monster_name + ' foi derrotado. Vitória!', c_lime);
                break;
            case CombatState.defeat:
                this.add_log('Você caiu... Fim de jogo.', c_red);
                break;
            case CombatState.fled:
                this.add_log('Você desengaja e corre para longe do ' + this.foe.monster_name + '.', c_ltgray);
                break;
        }
    }

    close_combat()
    {
        const hero = this.hero;
        const foe = this.foe;

        audio_stop_sound(this.combat_music);

        // O Cavalo de Troia devolve tudo que roubou quando a luta acaba (de um jeito ou de outro)
        if (this.is_trojan)
        {
            hero.armor_class = this.hero_armor_base;
            foe.armor_class = this.foe_armor_base;
            foe.pseudopod_bonus = this.foe_damage_base;
            this.stolen = [];
            if (this.state === CombatState.defeat) trojan_reset_after_defeat();
        }

        // O Firewall caído se levanta com 1 PV quando a luta acaba
        if (this.ally_in_party && this.ally.hp <= 0) this.ally.hp = 1;

        switch (this.state)
        {
            case CombatState.victory:
                hero.encounter_cooldown = 60;
                // O inimigo não some na hora: dá uma aulinha sobre o tema e depois desaparece
                foe.is_dying = true;
                if (!this.is_boss)
                {
                    foe.is_chasing = false;
                    foe.is_moving = false;
                    foe.alert_timer = 0;
                }
                instance_destroy(this);
                break;

            case CombatState.fled:
                hero.encounter_cooldown = 120;
                foe.stun_timer = 180;
                // O chefe se junta de novo num pedaço só, com a vida que sobrou
                if (!this.is_boss) foe.is_chasing = false;
                instance_destroy(this);
                break;

            case CombatState.defeat:
                room_restart();
                break;
        }
    }

    // ------------------------------------------------------------ Dano (aplicado pela fila, depois da animação dos dados)

    damage_foe(amount, piece = undefined)
    {
        if (this.is_boss && piece !== undefined)
        {
            piece.hp = Math.max(0, piece.hp - amount);
            piece.flash = 24;
            this.add_popup(false, '-' + amount, c_red, piece);

            if (piece.hp <= 0)
            {
                const index = this.pieces.indexOf(piece);
                if (index >= 0) this.pieces.splice(index, 1);
                this.add_log('Um pedaço do ' + this.foe.monster_name + ' se desfaz em pacotes perdidos!', c_lime);
                this.add_popup(false, 'DERRUBADO!', c_lime, piece);
            }

            this.foe.hp = this.boss_total_hp();
            if (this.pieces.length === 0) this.finish_combat(CombatState.victory);
            return;
        }

        this.foe.hp = Math.max(0, this.foe.hp - amount);
        this.foe_flash = 24;
        this.add_popup(false, '-' + amount, c_red);

        if (this.foe.hp <= 0) this.finish_combat(CombatState.victory);
    }

    damage_hero(amount)
    {
        this.hero.hp = Math.max(0, this.hero.hp - amount);
        this.rage_sustained = true;
        this.hero_flash = 24;
        this.add_popup(true, '-' + amount, c_red);

        if (this.hero.hp <= 0) this.finish_combat(CombatState.defeat);
    }

    damage_ally(amount)
    {
        const ally = this.ally;
        ally.hp = Math.max(0, ally.hp - amount);
        this.ally_flash = 24;
        this.add_popup(false, '-' + amount, c_red, undefined, true);

        if (ally.hp > 0) return;

        // Amuleto de Salamandra: renasce das cinzas uma vez por combate
        if (!this.ally_amulet_used)
        {
            this.ally_amulet_used = true;
            ally.hp = 1;
            this.add_log('O Amuleto de Salamandra brilha: o ' + ally.char_name + ' renasce das cinzas com 1 PV!', this.ally_colour);
            this.add_popup(false, 'RENASCEU!', this.ally_colour, undefined, true);
            return;
        }

        this.ally_dodging = false;
        this.add_log('O ' + ally.char_name + ' cai inconsciente! As chamas dele se apagam.', c_red);
        this.add_popup(false, 'CAIU!', c_red, undefined, true);
    }

    // ------------------------------------------------------------ Ações do bárbaro

    hero_attack(source)
    {
        // Ataque Imprudente é decidido no primeiro ataque do turno
        if (this.attacks_this_turn === 0 && this.reckless_selected)
        {
            this.reckless_active = true;
            this.queue_log('Ataque Imprudente! Vantagem nos seus ataques de Força neste turno.', c_orange);
            this.queue_popup(true, 'IMPRUDENTE!', c_orange);
        }

        this.attacks_this_turn += 1;
        this.rage_sustained = true;

        // Antes do golpe: timing no tempo certo aumenta o dano (contra o chefe: decide quantos golpes)
        this.queue_timing('attack', { source, multi: this.is_boss });
    }

    /// piece: pedaço do chefe que leva o golpe (undefined contra inimigos comuns)
    hero_attack_roll(source, timing, piece = undefined)
    {
        const hero = this.hero;
        const foe = this.foe;
        const advantage = this.reckless_active || this.trojan_reckless;
        const disadvantage = hero.exhaustion >= 3 || this.trojan_dodging;
        const strength_mod = ability_modifier(hero.strength);
        const attack_bonus = strength_mod + hero.proficiency_bonus;
        const roll = roll_d20(advantage, disadvantage);
        const total = roll.natural + attack_bonus;
        const is_critical = (roll.natural === 20);
        const hit = is_critical || (roll.natural !== 1 && total >= foe.armor_class);

        // Jogada de ataque
        const attack_event = dice_event_create(hero.char_name + ': ' + source, this.hero_colour);
        attack_event.target_text = 'vs CA ' + foe.armor_class;
        attack_event.mode_text = roll_mode_text(advantage, disadvantage,
            this.reckless_active ? 'Ataque Imprudente' : 'ele está Imprudente',
            this.trojan_dodging ? 'ele está Esquivando' : 'Exaustão');
        dice_event_add_d20(attack_event, roll, DICE_COLOUR_HERO, DICE_TEXT_DARK);
        dice_event_add_modifier(attack_event, strength_mod, 'Força');
        dice_event_add_modifier(attack_event, hero.proficiency_bonus, 'Proficiência');
        attack_event.total = total;
        attack_event.verdict = is_critical ? 'CRÍTICO!' : (hit ? 'ACERTOU!' : 'ERROU');
        attack_event.verdict_colour = is_critical ? c_yellow : (hit ? c_lime : make_colour_rgb(255, 110, 110));

        this.queue_lunge(true);
        this.queue_dice(attack_event);

        const text = source + ': ' + roll.text + format_modifier(attack_bonus) + ' = ' + total + ' vs CA ' + foe.armor_class;

        if (!hit)
        {
            this.queue_log(text + ' -> ERROU.', c_ltgray);
            this.queue_popup(false, 'Errou', c_ltgray);
            return;
        }

        this.queue_log(text + (is_critical ? ' -> CRÍTICO!' : ' -> ACERTOU!'), c_yellow);

        // Dano
        const dice = roll_dice(hero.weapon_dice_count * (is_critical ? 2 : 1), hero.weapon_dice_sides);
        let damage = dice.total + strength_mod;
        let damage_text = dice.text + format_modifier(strength_mod);

        const damage_event = dice_event_create('Dano: ' + source, c_orange);
        damage_event.mode_text = is_critical ? 'CRÍTICO: dados de dano dobrados' : '';
        dice_event_add_roll(damage_event, dice, DICE_COLOUR_SLASHING, c_white);
        dice_event_add_modifier(damage_event, strength_mod, 'Força');

        if (this.is_raging)
        {
            damage += hero.rage_damage_bonus;
            damage_text += '+' + hero.rage_damage_bonus + ' Fúria';
            dice_event_add_modifier(damage_event, hero.rage_damage_bonus, 'Fúria');
        }

        if (timing === TimingResult.perfect)
        {
            // Dado extra de dano: dobra no crítico, como qualquer dado de dano
            const timing_dice = roll_dice(is_critical ? 2 : 1, TIMING_ATTACK_PERFECT_DIE);
            damage += timing_dice.total;
            damage_text += '+' + timing_dice.text + ' timing';
            dice_event_add_roll(damage_event, timing_dice, DICE_COLOUR_TIMING, DICE_TEXT_DARK);
        }
        else if (timing === TimingResult.good)
        {
            damage += TIMING_ATTACK_GOOD_BONUS;
            damage_text += '+' + TIMING_ATTACK_GOOD_BONUS + ' timing';
            dice_event_add_modifier(damage_event, TIMING_ATTACK_GOOD_BONUS, 'Timing');
        }

        if (this.trojan_raging)
        {
            // Ele está com a SUA Fúria: resistência a cortante
            const halved = Math.floor(damage / 2);
            dice_event_add_modifier(damage_event, halved - damage, 'Fúria roubada');
            damage_text += ', metade pela Fúria roubada';
            damage = halved;
        }

        damage_event.total = damage;
        damage_event.total_label = 'cortante';

        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + damage_text + ' = ' + damage + ' cortante.', c_yellow);
        this.queue_damage(false, damage, piece);
    }

    hero_rage(frenzy)
    {
        this.hero.rage_uses -= 1;
        this.is_raging = true;
        this.is_frenzied = frenzy;
        this.rage_rounds_left = 10;
        this.rage_started_this_turn = true;
        this.bonus_used = true;
        this.hero_flash = 12;

        if (frenzy)
        {
            this.queue_log('FÚRIA FRENÉTICA! Nos próximos turnos você pode atacar com a Ação Bônus.', c_orange);
            this.queue_popup(true, 'FRENESI!', c_orange);
        }
        else
        {
            this.queue_log('FÚRIA! +' + this.hero.rage_damage_bonus + ' de dano e resistência a contundente, perfurante e cortante.', c_orange);
            this.queue_popup(true, 'FÚRIA!', c_orange);
        }
        this.queue_wait(30);
    }

    end_rage(reason)
    {
        this.is_raging = false;
        this.rage_rounds_left = 0;
        this.add_log(reason, c_orange);

        if (this.is_frenzied)
        {
            const hero = this.hero;
            this.is_frenzied = false;
            hero.exhaustion = Math.min(6, hero.exhaustion + 1);
            hero.hp = Math.min(hero.hp, hero.get_hp_max());
            this.add_log('O Frenesi cobra seu preço: exaustão nível ' + hero.exhaustion + '.', c_orange);
        }
    }

    // ------------------------------------------------------------ Magias do Firewall

    /// Antes de toda magia de dano vem o ritmo das chamas (4 notas); o resultado vira buff de fogo
    ally_cast(spell, name)
    {
        this.action_used = true;
        this.queue_log(this.ally.char_name + ' ergue o Cajado de Brasa: ' + name + '! Siga o ritmo das chamas.', this.ally_colour);
        this.queue_rhythm({ spell, name });
    }

    resolve_rhythm(event)
    {
        const texts = rhythm_result_text(event);
        this.ally_buff = rhythm_buff(event.hits);
        this.queue_log('Ritmo: ' + texts[0] + ' (' + texts[1] + ')', (this.ally_buff === undefined) ? c_ltgray : DICE_COLOUR_FIRE);
        if (this.ally_buff !== undefined) this.queue_popup_on(this.ally, (event.hits >= RHYTHM_NOTES) ? 'EM CHAMAS!' : 'FAGULHA', this.ally_colour);

        switch (event.data.spell)
        {
            case 'fire_bolt':
                if (this.is_boss) this.ally_start_boss_attacks(event.data.name, 1, 1, 10);
                else this.ally_spell_attack(event.data.name, 1, 10);
                break;

            case 'scorching_ray':
                if (this.is_boss) this.ally_start_boss_attacks(event.data.name, 3, 2, 6);
                else for (let i = 1; i <= 3; i++) this.ally_spell_attack(event.data.name + ' (' + i + '/3)', 2, 6);
                break;

            case 'burning_hands':
                this.ally_burning_hands(event.data.name);
                break;
        }
    }

    /// Soma o buff do ritmo num evento de dano (uma vez por magia) e devolve quanto deu
    ally_apply_buff(damage_event, is_critical)
    {
        if (this.ally_buff === undefined) return 0;

        const buff_dice = roll_dice(this.ally_buff.count * (is_critical ? 2 : 1), this.ally_buff.sides);
        dice_event_add_roll(damage_event, buff_dice, DICE_COLOUR_TIMING, DICE_TEXT_DARK);
        this.ally_buff = undefined;
        return buff_dice.total;
    }

    /// Chefe: cada rajada ou raio escolhe um pedaço, como os golpes do antivírus
    ally_start_boss_attacks(source, count, dice_count, dice_sides)
    {
        this.attacks_total = count;
        this.attacks_left = count;
        this.pending_source = source;
        this.pending_actor = this.ally;
        this.pending_dice = { count: dice_count, sides: dice_sides };
        this.target_index = clamp(this.target_index, 0, this.pieces.length - 1);
        this.queue_log((count === 1) ? 'Escolha o pedaço que leva o fogo.' : 'Escolha o alvo de cada um dos ' + count + ' raios.', this.ally_colour);
    }

    /// Ataque de magia à distância: d20 + Inteligência + Proficiência contra a CA, dano de fogo
    ally_spell_attack(source, dice_count, dice_sides, piece = undefined)
    {
        const ally = this.ally;
        const foe = this.foe;
        const int_mod = ability_modifier(ally.intelligence);
        const roll = roll_d20(false, false);
        const total = roll.natural + ally.spell_attack_bonus;
        const is_critical = (roll.natural === 20);
        const hit = is_critical || (roll.natural !== 1 && total >= foe.armor_class);

        const attack_event = dice_event_create(ally.char_name + ': ' + source, this.ally_colour);
        attack_event.target_text = 'vs CA ' + foe.armor_class;
        dice_event_add_d20(attack_event, roll, DICE_COLOUR_HERO, DICE_TEXT_DARK);
        dice_event_add_modifier(attack_event, int_mod, 'Inteligência');
        dice_event_add_modifier(attack_event, ally.proficiency_bonus, 'Proficiência');
        attack_event.total = total;
        attack_event.verdict = is_critical ? 'CRÍTICO!' : (hit ? 'ACERTOU!' : 'ERROU');
        attack_event.verdict_colour = is_critical ? c_yellow : (hit ? c_lime : make_colour_rgb(255, 110, 110));

        this.queue_lunge_on(ally);
        this.queue_dice(attack_event);

        const text = source + ': ' + roll.text + format_modifier(ally.spell_attack_bonus) + ' = ' + total + ' vs CA ' + foe.armor_class;

        if (!hit)
        {
            this.queue_log(text + ' -> ERROU.', c_ltgray);
            this.queue_popup(false, 'Errou', c_ltgray);
            return;
        }

        this.queue_log(text + (is_critical ? ' -> CRÍTICO!' : ' -> ACERTOU!'), c_yellow);

        const dice = roll_dice(dice_count * (is_critical ? 2 : 1), dice_sides);
        const damage_event = dice_event_create('Dano: ' + source, this.ally_colour);
        damage_event.mode_text = is_critical ? 'CRÍTICO: dados de dano dobrados' : '';
        dice_event_add_roll(damage_event, dice, DICE_COLOUR_FIRE, c_white);

        // O buff do ritmo entra no primeiro acerto da magia
        const buff = this.ally_apply_buff(damage_event, is_critical);
        const damage = dice.total + buff;

        damage_event.total = damage;
        damage_event.total_label = 'fogo';

        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + dice.text + ((buff > 0) ? ' + ' + buff + ' do ritmo' : '') + ' = ' + damage + ' de fogo.', this.ally_colour);
        this.queue_damage(false, damage, piece);
    }

    /// Mãos Flamejantes: um leque de fogo, TR de Destreza; no chefe pega todos os pedaços
    ally_burning_hands(source)
    {
        const ally = this.ally;
        const foe = this.foe;
        const dc = ally.spell_save_dc;
        const dice = roll_dice(3, 6);

        this.queue_lunge_on(ally);
        this.queue_log(source + ': um leque de chamas! TR de Destreza CD ' + dc + ', metade se passar.', this.ally_colour);

        // Todos os alvos: o inimigo comum ou cada pedaço do chefe
        const targets = this.is_boss ? this.pieces.slice() : [undefined];
        const count = targets.length;
        const save_bonus = ability_modifier(foe.dexterity);
        const saved = [];

        const save_event = dice_event_create(foe.monster_name + ': TR de Destreza (' + source + ')', this.foe_colour);
        save_event.target_text = 'vs CD ' + dc + '  (' + format_modifier(save_bonus) + ((count > 1) ? ' cada)' : ')');
        save_event.dice_label = 'd20';

        let failed = 0;
        for (let i = 0; i < count; i++)
        {
            const roll = roll_d20(false, false);
            const total = roll.natural + save_bonus;
            saved.push(total >= dc);
            if (!saved[i]) failed += 1;

            if (count === 1)
            {
                dice_event_add_d20(save_event, roll, DICE_COLOUR_FOE, c_white);
                dice_event_add_modifier(save_event, save_bonus, 'Destreza');
                save_event.total = total;
            }
            else
            {
                // Um dado por pedaço: quem passou apaga
                save_event.dice.push({ sides: 20, value: roll.natural, kept: !saved[i], colour: DICE_COLOUR_FOE, text_colour: c_white });
            }
            this.queue_log(((count > 1) ? 'Pedaço ' + (i + 1) + ': ' : 'TR: ') + roll.text + format_modifier(save_bonus) + ' = ' + total + (saved[i] ? ' -> passou, metade.' : ' -> falhou.'), saved[i] ? c_ltgray : this.ally_colour);
        }

        if (count === 1)
        {
            save_event.verdict = saved[0] ? 'PASSOU' : 'FALHOU';
        }
        else
        {
            save_event.hide_sum = true;
            save_event.verdict = failed + ' de ' + count + ((failed === 1) ? ' FALHOU' : ' FALHARAM');
        }
        save_event.verdict_colour = (failed > 0) ? this.ally_colour : c_ltgray;
        this.queue_dice(save_event);

        // Um dado de dano só para todos, como na mesa
        const damage_event = dice_event_create('Dano: ' + source, this.ally_colour);
        dice_event_add_roll(damage_event, dice, DICE_COLOUR_FIRE, c_white);
        const buff = this.ally_apply_buff(damage_event, false);
        const damage = dice.total + buff;
        damage_event.total = damage;
        damage_event.total_label = 'fogo';
        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + dice.text + ((buff > 0) ? ' + ' + buff + ' do ritmo' : '') + ' = ' + damage + ' de fogo (metade: ' + Math.floor(damage / 2) + ').', this.ally_colour);

        for (let i = 0; i < count; i++)
        {
            this.queue_damage(false, saved[i] ? Math.floor(damage / 2) : damage, targets[i]);
        }
    }

    /// Poção de Brasa Viva: cura quem estiver com menos vida, em proporção
    ally_potion()
    {
        const hero = this.hero;
        const ally = this.ally;
        this.action_used = true;
        ally.potions -= 1;

        const target = (hero.hp / hero.get_hp_max() <= ally.hp / ally.get_hp_max()) ? hero : ally;
        const dice = roll_dice(ally.potion_dice_count, ally.potion_dice_sides);
        const heal = dice.total + ally.potion_bonus;

        const heal_event = dice_event_create(ally.char_name + ': Poção de Brasa Viva', this.ally_colour);
        heal_event.target_text = 'em ' + target.char_name;
        dice_event_add_roll(heal_event, dice, DICE_COLOUR_FIRE, c_white);
        dice_event_add_modifier(heal_event, ally.potion_bonus, 'Poção');
        heal_event.total = heal;
        heal_event.total_label = 'PV';
        heal_event.fast = true;

        this.queue_log(ally.char_name + ' joga uma Poção de Brasa Viva em ' + ((target === ally) ? 'si mesmo' : 'você') + ': ' + dice.text + '+' + ally.potion_bonus + ' = ' + heal + ' PV.', c_lime);
        this.queue_dice(heal_event);
        this.queue_heal(target, heal);
        this.queue_wait(20);
    }

    // ------------------------------------------------------------ Ações do inimigo

    /// "você" ou "o Firewall": quem o inimigo ataca neste turno
    target_label() { return (this.foe_target === this.ally) ? 'o ' + this.ally.char_name : 'você'; }

    foe_act()
    {
        const foe = this.foe;

        // Escolhe no sorteio quem leva o ataque; o Firewall caído fica fora
        this.foe_target = (this.ally_in_party && this.ally.hp > 0 && irandom(1) === 0) ? this.ally : this.hero;

        if (this.is_trojan) this.trojan_turn_start();

        if (this.is_boss)
        {
            this.boss_flood();
            return;
        }

        // Recarga 5-6 no início do turno
        if (!foe.acid_spit_ready)
        {
            const recharge = roll_dice(1, 6);
            foe.acid_spit_ready = (recharge.total >= 5);

            const recharge_event = dice_event_create(foe.monster_name + ': recarga da habilidade ' + foe.spit_name, this.foe_colour);
            recharge_event.target_text = 'precisa de 5+';
            recharge_event.fast = true;
            dice_event_add_roll(recharge_event, recharge, DICE_COLOUR_FOE, c_white);
            recharge_event.total = recharge.total;
            recharge_event.verdict = foe.acid_spit_ready ? 'PRONTO!' : 'AINDA NÃO';
            recharge_event.verdict_colour = foe.acid_spit_ready ? this.hit_colour : c_ltgray;

            this.queue_dice(recharge_event);
            this.queue_log('Recarga de ' + foe.spit_name + ': ' + recharge.text + (foe.acid_spit_ready ? ' -> pronto!' : ' -> ainda não.'), this.foe_colour);
        }

        if (foe.acid_spit_ready && irandom(1) === 0)
        {
            this.foe_acid_spit();
        }
        else
        {
            // Multiataque: cada golpe tem a própria defesa, todos no mesmo alvo
            if (foe.attack_count > 1) this.queue_log('Multiataque! O ' + foe.monster_name + ' ataca ' + foe.attack_count + ' vezes.', this.foe_colour);
            for (let i = 0; i < foe.attack_count; i++) this.foe_pseudopod();
        }
    }

    foe_pseudopod()
    {
        // Antes do golpe: o jogador tenta defender no tempo certo
        this.queue_log('O ' + this.foe.monster_name + ' avança com ' + this.foe.attack_name.toLowerCase() + ' contra ' + this.target_label() + '. Defenda!', this.foe_colour);
        this.queue_timing('defend', { attack: 'pseudopod' });
    }

    foe_pseudopod_resolve(timing)
    {
        const foe = this.foe;
        const target = this.foe_target;

        // Imprudente e Fúria valem só contra o antivírus; cada um tem a própria Esquiva
        const on_ally = (target === this.ally);
        const advantage = (!on_ally && this.reckless_active) || this.trojan_reckless;
        const disadvantage = on_ally ? this.ally_dodging : this.is_dodging;
        const armor_class = target.armor_class;

        const roll = roll_d20(advantage, disadvantage);
        const total = roll.natural + foe.attack_bonus;
        const is_critical = (roll.natural === 20);
        const hit = is_critical || (roll.natural !== 1 && total >= armor_class);

        const attack_event = dice_event_create(foe.monster_name + ': ' + foe.attack_name + ' (alvo: ' + target.char_name + ')', this.foe_colour);
        attack_event.target_text = 'vs CA ' + armor_class;
        attack_event.mode_text = roll_mode_text(advantage, disadvantage, this.trojan_reckless ? 'Imprudente roubado' : 'você está Imprudente', this.target_label() + ' está Esquivando');
        dice_event_add_d20(attack_event, roll, DICE_COLOUR_FOE, c_white);
        dice_event_add_modifier(attack_event, foe.attack_bonus, 'Ataque');
        attack_event.total = total;
        attack_event.verdict = is_critical ? 'CRÍTICO!' : (hit ? 'ACERTOU!' : 'ERROU');
        attack_event.verdict_colour = hit ? this.hit_colour : c_lime;

        this.queue_lunge(false);
        this.queue_dice(attack_event);

        const text = foe.attack_name + ': ' + roll.text + format_modifier(foe.attack_bonus) + ' = ' + total + ' vs CA ' + armor_class;

        if (!hit)
        {
            this.queue_log(text + ' -> ERROU.', c_ltgray);
            this.queue_popup_on(target, 'Errou', c_ltgray);
            return;
        }

        this.queue_log(text + (is_critical ? ' -> CRÍTICO!' : ' -> ACERTOU!'), this.hit_colour);

        const critical_multiplier = is_critical ? 2 : 1;
        const bludgeon = roll_dice(foe.attack_dice_count * critical_multiplier, foe.attack_dice_sides);
        const acid = roll_dice(foe.acid_dice_count * critical_multiplier, foe.acid_dice_sides);   // 0 dados: sem dano extra
        let bludgeon_damage = bludgeon.total + foe.pseudopod_bonus;
        let damage_text = bludgeon.text + format_modifier(foe.pseudopod_bonus) + ' ' + foe.attack_damage_type;

        const damage_event = dice_event_create('Dano: ' + foe.attack_name, this.hit_colour);
        damage_event.mode_text = is_critical ? 'CRÍTICO: dados de dano dobrados' : '';
        dice_event_add_roll(damage_event, bludgeon, DICE_COLOUR_BLUDGEONING, DICE_TEXT_DARK);
        if (foe.acid_dice_count > 0) dice_event_add_roll(damage_event, acid, DICE_COLOUR_ACID, c_white);
        dice_event_add_modifier(damage_event, foe.pseudopod_bonus, foe.attack_damage_type);

        if (this.is_raging && !on_ally)
        {
            // Resistência: metade do dano físico (arredondado para baixo)
            const halved = Math.floor(bludgeon_damage / 2);
            dice_event_add_modifier(damage_event, halved - bludgeon_damage, 'Resist. Fúria');
            damage_text += ' (metade pela Fúria: ' + halved + ')';
            bludgeon_damage = halved;
        }

        const raw_damage = bludgeon_damage + acid.total;
        const damage = this.apply_timing_defense(damage_event, raw_damage, timing);
        damage_event.total = damage;
        damage_event.total_label = 'dano';

        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + damage_text + ((foe.acid_dice_count > 0) ? ' + ' + acid.text + ' ácido' : '') + ((damage !== raw_damage) ? ', defesa ' + format_modifier(damage - raw_damage) : '') + ' = ' + damage + '.', this.hit_colour);
        this.queue_damage_on(target, damage);
    }

    foe_acid_spit()
    {
        this.foe.acid_spit_ready = false;

        this.queue_log('O ' + this.foe.monster_name + ' prepara ' + this.foe.spit_name + ' contra ' + this.target_label() + '. Defenda!', this.foe_colour);
        this.queue_timing('defend', { attack: 'acid_spit' });
    }

    foe_acid_spit_resolve(timing)
    {
        const foe = this.foe;
        const target = this.foe_target;

        // Antivírus: Sentido de Perigo dá vantagem em TR de Destreza. Firewall: só se estiver Esquivando
        const on_ally = (target === this.ally);
        const advantage = on_ally ? this.ally_dodging : true;
        const disadvantage = !on_ally && this.hero.exhaustion >= 3;
        const save_bonus = ability_modifier(target.dexterity);
        const roll = roll_d20(advantage, disadvantage);
        const total = roll.natural + save_bonus;
        const saved = (total >= foe.acid_spit_dc);

        this.queue_lunge(false);
        this.queue_log(foe.spit_name + '! TR de Destreza CD ' + foe.acid_spit_dc + '.', this.hit_colour);

        const save_event = dice_event_create(target.char_name + ': TR de Destreza (' + foe.spit_name + ')', on_ally ? this.ally_colour : this.hero_colour);
        save_event.target_text = 'vs CD ' + foe.acid_spit_dc;
        save_event.mode_text = roll_mode_text(advantage, disadvantage, on_ally ? 'Esquivando' : 'Sentido de Perigo', 'Exaustão');
        dice_event_add_d20(save_event, roll, DICE_COLOUR_HERO, DICE_TEXT_DARK);
        dice_event_add_modifier(save_event, save_bonus, 'Destreza');
        save_event.total = total;
        save_event.verdict = saved ? 'SUCESSO' : 'FALHOU';
        save_event.verdict_colour = saved ? c_lime : this.hit_colour;

        this.queue_dice(save_event);
        this.queue_log(roll.text + format_modifier(save_bonus) + ' = ' + total + (saved ? ' -> SUCESSO, metade do dano.' : ' -> FALHOU.'), saved ? c_ltgray : this.hit_colour);

        const dice = roll_dice(foe.acid_spit_dice_count, 6);
        let damage = dice.total;

        const damage_event = dice_event_create('Dano: ' + foe.spit_name, this.hit_colour);
        dice_event_add_roll(damage_event, dice, DICE_COLOUR_ACID, c_white);

        if (saved)
        {
            damage = Math.floor(dice.total / 2);
            dice_event_add_modifier(damage_event, damage - dice.total, 'Metade (TR)');
        }

        const before_defense = damage;
        damage = this.apply_timing_defense(damage_event, damage, timing);
        damage_event.total = damage;
        damage_event.total_label = foe.spit_damage_type;

        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + dice.text + ' ' + foe.spit_damage_type + (saved ? ', metade' : '') + ((damage !== before_defense) ? ', defesa ' + format_modifier(damage - before_defense) : '') + ' = ' + damage + '.', this.hit_colour);
        this.queue_damage_on(target, damage);
    }

    // ------------------------------------------------------------ Chefe Cavalo de Troia

    trojan_has(key) { return this.stolen.includes(key); }

    /// Início do turno dele: acabam os efeitos "até o próximo turno dele", rouba a cada 3 turnos e às vezes usa o que roubou
    trojan_turn_start()
    {
        this.trojan_reckless = false;
        this.trojan_dodging = false;
        this.trojan_turns += 1;

        if (this.trojan_turns % TROJAN_STEAL_EVERY === 0) this.trojan_steal();
        if (this.stolen.length > 0 && irandom(1) === 0) this.trojan_use_stolen();
    }

    trojan_steal()
    {
        const hero = this.hero;
        const foe = this.foe;

        // Escolhe entre as que ainda são suas (decide antes de devolver: não pega de volta a que acabou de soltar)
        const choices = trojan_abilities().map((ability) => ability.key).filter((key) => !this.trojan_has(key));
        if (choices.length === 0) return;
        const key = choices[irandom(choices.length - 1)];

        if (this.stolen.length >= TROJAN_MAX_STOLEN) this.trojan_return(this.stolen[0]);

        this.stolen.push(key);
        const name = trojan_ability_name(key);

        this.queue_log('O compartimento do ' + foe.monster_name + ' se abre... e ROUBA a sua habilidade: ' + name + '!', this.foe_colour);
        this.event_queue.push({ type: 'hatch' });
        this.queue_popup(true, '-' + name.toUpperCase(), this.foe_colour);

        switch (key)
        {
            case 'rage':
                // Habilidade em andamento: ele arranca de você (sem a exaustão do Frenesi, não foi culpa sua)
                if (this.is_raging)
                {
                    this.is_frenzied = false;
                    this.end_rage('O ' + foe.monster_name + ' arranca a Fúria de você!');
                }
                break;

            case 'reckless':
                this.reckless_selected = false;
                this.reckless_active = false;
                break;

            case 'dodge':
                if (this.is_dodging) this.queue_log('Sua guarda some junto: você não está mais Esquivando.', c_ltgray);
                this.is_dodging = false;
                break;

            case 'defense':
                // Passiva: vale para ele na hora
                hero.armor_class = this.hero_armor_base - 2;
                foe.armor_class = this.foe_armor_base + 2;
                this.queue_log('Sua Defesa sem Armadura agora protege ELE: sua CA cai para ' + hero.armor_class + ', a dele sobe para ' + foe.armor_class + '.', this.foe_colour);
                break;
        }
        this.queue_wait(40);
    }

    trojan_return(key)
    {
        const index = this.stolen.indexOf(key);
        if (index < 0) return;
        this.stolen.splice(index, 1);

        switch (key)
        {
            case 'rage':
                this.trojan_raging = false;
                this.foe.pseudopod_bonus = this.foe_damage_base;
                break;
            case 'reckless':
                this.trojan_reckless = false;
                break;
            case 'dodge':
                this.trojan_dodging = false;
                break;
            case 'defense':
                this.hero.armor_class = this.hero_armor_base;
                this.foe.armor_class = this.foe_armor_base;
                break;
        }

        this.queue_log('Não cabe mais nada no cavalo: ele devolve a mais antiga, ' + trojan_ability_name(key) + '.', c_lime);
        this.queue_popup(true, '+' + trojan_ability_name(key).toUpperCase(), c_lime);
    }

    /// Usa uma das habilidades roubadas (a Defesa sem Armadura já vale sozinha)
    trojan_use_stolen()
    {
        const foe = this.foe;
        const usable = this.stolen.filter((key) => key !== 'defense' && !(key === 'rage' && this.trojan_raging));
        if (usable.length === 0) return;

        switch (usable[irandom(usable.length - 1)])
        {
            case 'rage':
                this.trojan_raging = true;
                foe.pseudopod_bonus = this.foe_damage_base + 2;
                this.queue_log('O ' + foe.monster_name + ' usa a SUA Fúria! +2 de dano e resistência ao seu machado enquanto ele tiver ela.', this.foe_colour);
                this.queue_popup(false, 'FÚRIA ROUBADA!', c_orange);
                break;

            case 'reckless':
                this.trojan_reckless = true;
                this.queue_log('O ' + foe.monster_name + ' ataca de um jeito Imprudente, igualzinho a você! Vantagem para ele agora, e para você até o próximo turno dele.', this.foe_colour);
                this.queue_popup(false, 'IMPRUDENTE!', c_orange);
                break;

            case 'dodge':
                this.trojan_dodging = true;
                this.queue_log('O ' + foe.monster_name + ' usa o SEU Esquivar! Seus ataques têm desvantagem até o próximo turno dele.', this.foe_colour);
                this.queue_popup(false, 'ESQUIVA!', this.foe_colour);
                break;
        }
        this.queue_wait(30);
    }

    /// Itens do menu ligados a uma habilidade roubada ficam cinza
    trojan_lock_menu(items)
    {
        const ability_of = { rage: 'rage', frenzy_rage: 'rage', frenzy_attack: 'rage', reckless: 'reckless', dodge: 'dodge' };

        for (const item of items)
        {
            const ability = ability_of[item.key];
            if (ability !== undefined && this.trojan_has(ability))
            {
                item.enabled = false;
                item.label += ' [ROUBADA]';
                item.description = 'ROUBADA pelo ' + this.foe.monster_name + '! Ela volta quando ele roubar uma terceira habilidade ou quando a luta acabar. ' + item.description;
            }
        }
    }

    // ------------------------------------------------------------ Chefe DDoS

    boss_total_hp() { return this.pieces.reduce((total, piece) => total + piece.hp, 0); }

    /// Posição de cada pedaço na arena (usado pelo Step para o mouse e pelo Draw GUI).
    /// Até 3 pedaços numa fileira; mais que isso, duas fileiras (a de trás um pouco mais alta).
    boss_piece_slots(arena)
    {
        const count = this.pieces.length;
        const slots = [];
        if (count === 0) return slots;

        const ground_y = arena.y2 - 40;
        const left = lerp(arena.x1, arena.x2, 0.48);
        const right = lerp(arena.x1, arena.x2, 0.96);
        const rows = (count <= 3) ? 1 : 2;
        const per_row = Math.ceil(count / rows);

        for (let i = 0; i < count; i++)
        {
            const row = Math.floor(i / per_row);
            const column = i % per_row;
            const in_row = Math.min(per_row, count - row * per_row);
            const x = lerp(left, right, (column + 0.5) / in_row);
            const ground = ground_y - ((rows === 2 && row === 0) ? 70 : 0);

            // Tamanho pela vida com que o pedaço nasceu: metade da vida, pedaço menor
            const scale = clamp(0.4 * Math.sqrt(this.pieces[i].hp_max / this.foe.hp_max), 0.11, 0.4);

            slots.push({ x, ground, scale, x1: x - 150 * scale, y1: ground - 380 * scale, x2: x + 150 * scale, y2: ground });
        }

        return slots;
    }

    /// Resultado do timing vira número de golpes; o alvo de cada um é escolhido no Step
    boss_start_attacks(source, timing)
    {
        switch (timing)
        {
            case TimingResult.perfect: this.attacks_total = 3; break;
            case TimingResult.good:    this.attacks_total = 2; break;
            default:                   this.attacks_total = 1; break;
        }

        this.attacks_left = this.attacks_total;
        this.pending_source = source;
        this.pending_actor = this.hero;
        this.target_index = clamp(this.target_index, 0, this.pieces.length - 1);
        this.queue_log('Você prepara ' + this.attacks_total + ((this.attacks_total === 1) ? ' golpe' : ' golpes') + '. Escolha o alvo de cada um.', this.hero_colour);
    }

    /// Um golpe no pedaço escolhido (sem bônus de dano do timing: o timing já virou golpes extras)
    boss_strike(piece)
    {
        this.attacks_left -= 1;
        const number = this.attacks_total - this.attacks_left;
        const source = this.pending_source + ((this.attacks_total > 1) ? ' (' + number + '/' + this.attacks_total + ')' : '');
        if (this.pending_actor === this.ally) this.ally_spell_attack(source, this.pending_dice.count, this.pending_dice.sides, piece);
        else this.hero_attack_roll(source, TimingResult.miss, piece);
    }

    /// Turno do chefe: todos os pedaços atacam juntos, e você defende a rajada inteira de uma vez
    boss_flood()
    {
        const count = this.pieces.length;
        this.queue_log('O ' + this.foe.monster_name + ' inunda ' + this.target_label() + ' com ' + count + ((count === 1) ? ' ataque' : ' ataques') + ' ao mesmo tempo! Defenda!', this.foe_colour);
        this.queue_timing('defend', { attack: 'flood' });
    }

    boss_flood_resolve(timing)
    {
        const foe = this.foe;
        const target = this.foe_target;
        const count = this.pieces.length;
        const hits = [];
        const criticals = [];

        const on_ally = (target === this.ally);
        const advantage = !on_ally && this.reckless_active;
        const disadvantage = on_ally ? this.ally_dodging : this.is_dodging;
        const armor_class = target.armor_class;

        const attack_event = dice_event_create(foe.monster_name + ': Inundação (' + count + ((count === 1) ? ' pedaço)' : ' pedaços)'), this.foe_colour);
        attack_event.target_text = 'vs CA ' + armor_class + '  (+' + foe.attack_bonus + ' cada)';
        attack_event.mode_text = roll_mode_text(advantage, disadvantage, 'você está Imprudente', this.target_label() + ' está Esquivando');
        attack_event.hide_sum = true;
        attack_event.dice_label = 'd20';

        for (let i = 0; i < count; i++)
        {
            const roll = roll_d20(advantage, disadvantage);
            const total = roll.natural + foe.attack_bonus;
            const is_critical = (roll.natural === 20);
            const hit = is_critical || (roll.natural !== 1 && total >= armor_class);

            // Um dado por pedaço: os que erraram apagam
            attack_event.dice.push({ sides: 20, value: roll.natural, kept: hit, colour: DICE_COLOUR_FOE, text_colour: c_white });

            if (hit)
            {
                hits.push(this.pieces[i]);
                criticals.push(is_critical);
            }
            this.queue_log('Pedaço ' + (i + 1) + ': ' + roll.text + format_modifier(foe.attack_bonus) + ' = ' + total + (hit ? (is_critical ? ' -> CRÍTICO!' : ' -> acertou') : ' -> errou'), hit ? this.hit_colour : c_ltgray);
        }

        const hit_count = hits.length;
        attack_event.verdict = (hit_count === 0) ? 'NENHUM ACERTOU' : hit_count + ' de ' + count + ((hit_count === 1) ? ' ACERTOU!' : ' ACERTARAM!');
        attack_event.verdict_colour = (hit_count === 0) ? c_lime : this.hit_colour;

        this.queue_lunge(false);
        this.queue_dice(attack_event);

        if (hit_count === 0)
        {
            this.queue_popup_on(target, 'Errou tudo', c_ltgray);
            return;
        }

        // Dano somado de todos os acertos; pedaços menores batem mais fraco
        const damage_event = dice_event_create('Dano: Inundação', this.hit_colour);
        let bludgeon_total = 0;
        let acid_total = 0;
        let bludgeon_bonus = 0;

        for (let i = 0; i < hit_count; i++)
        {
            const tier = boss_piece_tier(hits[i]);
            const multiplier = criticals[i] ? 2 : 1;

            if (tier.bludgeon_dice > 0)
            {
                const bludgeon = roll_dice(tier.bludgeon_dice * multiplier, 6);
                dice_event_add_roll(damage_event, bludgeon, DICE_COLOUR_BLUDGEONING, DICE_TEXT_DARK);
                bludgeon_total += bludgeon.total;
                bludgeon_bonus += tier.bludgeon_bonus;
            }

            const acid = roll_dice(tier.acid_count * multiplier, tier.acid_sides);
            dice_event_add_roll(damage_event, acid, DICE_COLOUR_ACID, c_white);
            acid_total += acid.total;
        }

        let bludgeon_damage = bludgeon_total + bludgeon_bonus;
        if (bludgeon_bonus !== 0) dice_event_add_modifier(damage_event, bludgeon_bonus, 'Contundente');

        if (this.is_raging && !on_ally && bludgeon_damage > 0)
        {
            // Resistência: metade do dano contundente
            const halved = Math.floor(bludgeon_damage / 2);
            dice_event_add_modifier(damage_event, halved - bludgeon_damage, 'Resist. Fúria');
            bludgeon_damage = halved;
        }

        const raw_damage = bludgeon_damage + acid_total;
        const damage = this.apply_timing_defense(damage_event, raw_damage, timing);
        damage_event.total = damage;
        damage_event.total_label = 'dano';

        this.queue_dice(damage_event);
        this.queue_log('Dano da inundação: ' + bludgeon_damage + ' contundente + ' + acid_total + ' ácido' + ((damage !== raw_damage) ? ', defesa ' + format_modifier(damage - raw_damage) : '') + ' = ' + damage + '.', this.hit_colour);
        this.queue_damage_on(target, damage);
    }

    /// Fim do turno do chefe: cada pedaço com 2+ PV se divide em dois com metade da vida (nunca menos de 1)
    boss_split()
    {
        // Os maiores dividem primeiro, até o limite de pedaços na tela
        this.pieces.sort((a, b) => b.hp - a.hp);

        const result = [];
        let splits = 0;
        const room = BOSS_DDOS_MAX_PIECES - this.pieces.length;

        for (const piece of this.pieces)
        {
            if (piece.hp >= 2 && splits < room)
            {
                const half = Math.floor(piece.hp / 2);
                result.push(boss_piece_create(piece.hp - half), boss_piece_create(half));
                splits += 1;
            }
            else
            {
                result.push(piece);
            }
        }

        if (splits === 0) return;

        this.pieces = result;
        this.target_index = 0;
        this.foe_flash = 20;
        this.add_log('O ' + this.foe.monster_name + ' se divide! ' + splits + ((splits === 1) ? ' pedaço virou dois' : ' pedaços viraram dois') + ', cada um com metade da vida. Agora são ' + this.pieces.length + '.', this.foe_colour);
        this.add_popup(false, 'SE DIVIDIU!', this.foe_colour);
        this.wait_timer = 40;
    }

    // ------------------------------------------------------------ Menu

    build_menu()
    {
        if (this.state === CombatState.ally_turn) return this.build_ally_menu();

        const hero = this.hero;
        const items = [];

        items.push({
            key: 'attack',
            label: 'Atacar: ' + hero.weapon_name,
            cost: 'Ação',
            enabled: !this.action_used,
            description: 'Ataque corpo a corpo: d20' + format_modifier(ability_modifier(hero.strength) + hero.proficiency_bonus)
                + ' contra a CA. Dano ' + hero.weapon_dice_count + 'd' + hero.weapon_dice_sides
                + format_modifier(ability_modifier(hero.strength)) + ' cortante (+' + hero.rage_damage_bonus
                + ' em Fúria). 20 natural é crítico: dados de dano dobrados. '
                + (this.is_boss
                    ? 'Antes do golpe, acerte o tempo: perfeito = 3 golpes, bom = 2, fora do tempo = 1. Você escolhe o alvo de cada golpe.'
                    : 'Antes do golpe, acerte o tempo: +1d' + TIMING_ATTACK_PERFECT_DIE + ' de dano (perfeito) ou +' + TIMING_ATTACK_GOOD_BONUS + ' (bom).'),
        });

        items.push({
            key: 'reckless',
            label: 'Ataque Imprudente: ' + (this.reckless_selected ? 'LIGADO' : 'DESLIGADO'),
            cost: 'Livre',
            enabled: this.attacks_this_turn === 0,
            description: 'Ataque Imprudente (Bárbaro 2): ao fazer o primeiro ataque do turno, você ganha vantagem nos ataques de Força deste turno. Até o seu próximo turno, ataques contra você também têm vantagem.',
        });

        if (!this.is_raging)
        {
            items.push({
                key: 'rage',
                label: 'Fúria (' + hero.rage_uses + '/' + hero.rage_uses_max + ')',
                cost: 'Ação Bônus',
                enabled: !this.bonus_used && hero.rage_uses > 0,
                description: 'Fúria (Bárbaro 1): por 1 minuto, +' + hero.rage_damage_bonus + ' de dano em ataques de Força, resistência a dano contundente, perfurante e cortante e vantagem em testes de Força. Termina cedo se você passar um turno sem atacar nem sofrer dano.',
            });

            items.push({
                key: 'frenzy_rage',
                label: 'Fúria Frenética (' + hero.rage_uses + '/' + hero.rage_uses_max + ')',
                cost: 'Ação Bônus',
                enabled: !this.bonus_used && hero.rage_uses > 0,
                description: 'Frenesi (Caminho do Berserker 3): entra em Fúria em frenesi. Nos turnos seguintes você pode fazer um ataque com a Ação Bônus. Quando a Fúria acabar, você sofre 1 nível de exaustão.',
            });
        }

        if (this.is_frenzied)
        {
            items.push({
                key: 'frenzy_attack',
                label: 'Ataque Frenético',
                cost: 'Ação Bônus',
                enabled: !this.bonus_used && !this.rage_started_this_turn,
                description: 'Frenesi: um ataque extra com o ' + hero.weapon_name + ' usando a Ação Bônus. Não pode ser usado no turno em que a Fúria começou.',
            });
        }

        items.push({
            key: 'dodge',
            label: 'Esquivar',
            cost: 'Ação',
            enabled: !this.action_used,
            description: 'Esquivar: até o seu próximo turno, ataques contra você têm desvantagem e você tem vantagem em testes de resistência de Destreza.',
        });

        items.push({
            key: 'flee',
            label: 'Fugir',
            cost: 'Ação',
            enabled: !this.action_used,
            description: 'Desengajar e correr: você sai do combate sem sofrer ataques. O ' + this.foe.monster_name + ' fica atordoado por alguns segundos.',
        });

        items.push({
            key: 'end',
            label: 'Encerrar turno',
            cost: '',
            enabled: true,
            description: 'Termina o seu turno. Lembre: a Fúria se apaga se você não atacou nem sofreu dano desde o seu último turno.',
        });

        if (this.is_trojan) this.trojan_lock_menu(items);
        return items;
    }

    build_ally_menu()
    {
        const ally = this.ally;
        const items = [];
        const attack_text = 'd20' + format_modifier(ally.spell_attack_bonus);
        const rhythm_text = ' Antes, o ritmo das chamas: acerte as 4 notas para +' + RHYTHM_STRONG_DICE + 'd' + RHYTHM_STRONG_SIDES
            + ' de fogo; 3 de 4 dá só +' + RHYTHM_WEAK_DICE + 'd' + RHYTHM_WEAK_SIDES + '; 2 ou menos, nada.';

        items.push({
            key: 'fire_bolt',
            label: 'Rajada de Fogo (truque)',
            cost: 'Ação',
            enabled: !this.action_used,
            description: 'Truque de Evocação: ataque de magia à distância ' + attack_text + ' contra a CA. Dano 1d10 de fogo. 20 natural dobra os dados.'
                + (this.is_boss ? ' Você escolhe o pedaço alvo.' : '') + rhythm_text,
        });

        items.push({
            key: 'burning_hands',
            label: 'Mãos Flamejantes (' + ally.slots_1 + '/' + ally.slots_1_max + ')',
            cost: 'Ação',
            enabled: !this.action_used && ally.slots_1 > 0,
            description: 'Magia de círculo 1: um leque de fogo. TR de Destreza CD ' + ally.spell_save_dc + ', 3d6 de fogo, metade se passar.'
                + (this.is_boss ? ' Pega TODOS os pedaços do ' + this.foe.monster_name + ' de uma vez.' : '') + ' Esculpir Magias: o Antivírus nunca é queimado.' + rhythm_text,
        });

        items.push({
            key: 'scorching_ray',
            label: 'Raio Ardente (' + ally.slots_2 + '/' + ally.slots_2_max + ')',
            cost: 'Ação',
            enabled: !this.action_used && ally.slots_2 > 0,
            description: 'Magia de círculo 2: três raios de fogo, cada um com ataque ' + attack_text + ' e 2d6 de fogo.'
                + (this.is_boss ? ' Você escolhe o pedaço de cada raio.' : '') + ' O buff do ritmo vai no primeiro raio que acertar.' + rhythm_text,
        });

        items.push({
            key: 'potion',
            label: 'Poção de Brasa Viva (' + ally.potions + '/' + ally.potions_max + ')',
            cost: 'Ação',
            enabled: !this.action_used && ally.potions > 0,
            description: 'Cura ' + ally.potion_dice_count + 'd' + ally.potion_dice_sides + '+' + ally.potion_bonus
                + ' PV de quem estiver com menos vida (em proporção): você ou o próprio ' + ally.char_name + '. As poções são reacesas no descanso longo.',
        });

        items.push({
            key: 'ally_dodge',
            label: 'Esquivar',
            cost: 'Ação',
            enabled: !this.action_used,
            description: 'Esquivar: até o próximo turno do ' + ally.char_name + ', ataques contra ele têm desvantagem e ele tem vantagem em testes de resistência de Destreza.',
        });

        items.push({
            key: 'end',
            label: 'Encerrar turno',
            cost: '',
            enabled: true,
            description: 'Termina o turno do ' + ally.char_name + '.',
        });

        return items;
    }

    hero_has_options() { return this.menu_items.some((item) => item.enabled && item.key !== 'end' && item.key !== 'reckless'); }

    run_menu_item(key)
    {
        switch (key)
        {
            case 'attack':
                this.action_used = true;
                this.hero_attack(this.hero.weapon_name);
                break;

            case 'reckless':
                this.reckless_selected = !this.reckless_selected;
                break;

            case 'rage':
                this.hero_rage(false);
                break;

            case 'frenzy_rage':
                this.hero_rage(true);
                break;

            case 'frenzy_attack':
                this.bonus_used = true;
                this.hero_attack('Ataque Frenético');
                break;

            case 'dodge':
                this.action_used = true;
                this.is_dodging = true;
                this.queue_log('Você assume postura defensiva e se prepara para esquivar.', this.hero_colour);
                this.queue_popup(true, 'ESQUIVA', this.hero_colour);
                this.queue_wait(30);
                break;

            case 'flee':
                this.action_used = true;
                this.finish_combat(CombatState.fled);
                break;

            case 'fire_bolt':
                this.ally_cast('fire_bolt', 'Rajada de Fogo');
                break;

            case 'burning_hands':
                this.ally.slots_1 -= 1;
                this.ally_cast('burning_hands', 'Mãos Flamejantes');
                break;

            case 'scorching_ray':
                this.ally.slots_2 -= 1;
                this.ally_cast('scorching_ray', 'Raio Ardente');
                break;

            case 'potion':
                this.ally_potion();
                break;

            case 'ally_dodge':
                this.action_used = true;
                this.ally_dodging = true;
                this.queue_log('O ' + this.ally.char_name + ' se envolve no Manto de Brasas e se prepara para esquivar.', this.ally_colour);
                this.queue_popup_on(this.ally, 'ESQUIVA', this.ally_colour);
                this.queue_wait(30);
                break;

            case 'end':
                this.end_current_turn();
                break;
        }
    }

    // ------------------------------------------------------------ Step: fluxo de turnos e entrada do jogador

    /// Verdadeiro se o mouse se mexeu desde a última chamada
    mouse_moved()
    {
        const moved = (device_mouse_x_to_gui() !== this.mouse_last_x || device_mouse_y_to_gui() !== this.mouse_last_y);
        this.mouse_last_x = device_mouse_x_to_gui();
        this.mouse_last_y = device_mouse_y_to_gui();
        return moved;
    }

    step()
    {
        this.anim_time += 1;

        // Garantia do loop: se a música parar, recomeça do início
        if (!audio_is_playing(this.combat_music)) this.combat_music = audio_play_sound(this.combat_music_asset, true, 0.6);
        this.hero_lunge = Math.max(0, this.hero_lunge - 1);
        this.foe_lunge = Math.max(0, this.foe_lunge - 1);
        this.foe_hatch = Math.max(0, this.foe_hatch - 1);
        this.ally_lunge = Math.max(0, this.ally_lunge - 1);
        this.hero_flash = Math.max(0, this.hero_flash - 1);
        this.ally_flash = Math.max(0, this.ally_flash - 1);
        this.foe_flash = Math.max(0, this.foe_flash - 1);

        for (const piece of this.pieces) piece.flash = Math.max(0, piece.flash - 1);

        for (let i = this.popups.length - 1; i >= 0; i--)
        {
            this.popups[i].timer -= 1;
            if (this.popups[i].timer <= 0) this.popups.splice(i, 1);
        }

        let confirm = keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space) || keyboard_check_pressed(ord('Z'));

        // Rolagens e efeitos em andamento: Enter/clique acelera a animação dos dados
        if (this.process_queue(confirm || mouse_check_button_pressed())) return;

        if (this.wait_timer > 0)
        {
            this.wait_timer -= 1;
            return;
        }

        switch (this.state)
        {
            case CombatState.intro:
                this.begin_turn();
                break;

            case CombatState.hero_turn:
            case CombatState.ally_turn:
            {
                // Chefe: escolher o alvo de cada golpe (do antivírus ou dos raios do Firewall)
                if (this.attacks_left > 0)
                {
                    const piece_count = this.pieces.length;
                    if (piece_count === 0)
                    {
                        this.attacks_left = 0;
                        break;
                    }

                    this.target_index = clamp(this.target_index, 0, piece_count - 1);

                    // Sobrou um pedaço só: nem precisa escolher
                    if (piece_count === 1)
                    {
                        this.boss_strike(this.pieces[0]);
                        break;
                    }

                    const step = (keyboard_check_pressed(vk_right) || keyboard_check_pressed(ord('D')) || keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S')))
                        - (keyboard_check_pressed(vk_left) || keyboard_check_pressed(ord('A')) || keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W')));
                    if (step !== 0) this.target_index = (this.target_index + step + piece_count) % piece_count;

                    // Mouse: passar por cima mira, clicar golpeia
                    const moved = this.mouse_moved();
                    this.boss_piece_slots(this.get_layout().arena).forEach((slot, index) =>
                    {
                        if (point_in_rectangle(device_mouse_x_to_gui(), device_mouse_y_to_gui(), slot.x1, slot.y1, slot.x2, slot.y2))
                        {
                            if (moved) this.target_index = index;
                            if (mouse_check_button_pressed())
                            {
                                this.target_index = index;
                                confirm = true;
                            }
                        }
                    });

                    if (confirm) this.boss_strike(this.pieces[this.target_index]);
                    break;
                }

                this.menu_items = this.build_menu();

                if (!this.hero_has_options())
                {
                    this.end_current_turn();
                    break;
                }

                const count = this.menu_items.length;
                this.menu_index = clamp(this.menu_index, 0, count - 1);

                if (keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W'))) this.menu_index = (this.menu_index - 1 + count) % count;
                if (keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S'))) this.menu_index = (this.menu_index + 1) % count;

                // Mouse: passar por cima seleciona, clicar confirma
                const layout = this.get_layout();
                const moved = this.mouse_moved();
                for (let index = 0; index < count; index++)
                {
                    const item_y = layout.menu_first_y + index * layout.menu_line_height;
                    if (point_in_rectangle(device_mouse_x_to_gui(), device_mouse_y_to_gui(), layout.menu.x1 + 8, item_y - 3, layout.menu.x2 - 8, item_y + layout.menu_line_height - 4))
                    {
                        if (moved) this.menu_index = index;
                        if (mouse_check_button_pressed())
                        {
                            this.menu_index = index;
                            confirm = true;
                        }
                    }
                }

                if (confirm)
                {
                    const item = this.menu_items[this.menu_index];
                    if (item.enabled) this.run_menu_item(item.key);
                }
                break;
            }

            case CombatState.foe_turn:
                if (!this.foe_has_acted)
                {
                    this.foe_act();
                    this.foe_has_acted = true;
                    this.wait_timer = 60;
                }
                else
                {
                    // Fim do turno do chefe: ele se divide
                    if (this.is_boss) this.boss_split();
                    this.next_turn();
                }
                break;

            case CombatState.victory:
            case CombatState.defeat:
            case CombatState.fled:
                if (confirm || mouse_check_button_pressed()) this.close_combat();
                break;
        }
    }

    draw() {}

    // ------------------------------------------------------------ Draw GUI: tela de combate

    draw_gui()
    {
        const hero = this.hero;
        const ally = this.ally;
        const foe = this.foe;
        const layout = this.get_layout();
        const line = layout.line_height;
        const busy = this.event_queue.length > 0 || this.wait_timer > 0;

        // Pixel art nítida
        gpu_set_texfilter(false);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        // Escurece o mapa por trás
        draw_set_alpha(0.8);
        draw_set_colour(c_black);
        draw_rectangle(0, 0, layout.width, layout.height, false);
        draw_set_alpha(1);
        draw_set_colour(c_white);

        // ---- Arena

        const arena = layout.arena;
        // Fundo animado (10 quadros por segundo), recortado na proporção da arena para não esticar
        const arena_w = arena.x2 - arena.x1;
        const arena_h = arena.y2 - arena.y1;
        const bg_w = sprite_get_width('spr_combat_bg');
        const bg_h = Math.min(sprite_get_height('spr_combat_bg'), bg_w * arena_h / arena_w);
        const bg_top = (sprite_get_height('spr_combat_bg') - bg_h) * 0.3;
        const bg_frame = Math.floor(current_time_ms() / 100) % sprite_get_number('spr_combat_bg');
        draw_sprite_part_ext('spr_combat_bg', bg_frame, 0, bg_top, bg_w, bg_h, arena.x1, arena.y1, arena_w / bg_w, arena_h / bg_h, c_white, 1);
        draw_set_colour(UI_BORDER);
        draw_rectangle(arena.x1, arena.y1, arena.x2, arena.y2, true);
        draw_set_colour(c_white);

        let title = 'COMBATE - Rodada ' + this.round_number;
        if (this.state === CombatState.hero_turn) title += ' - Seu turno';
        else if (this.state === CombatState.ally_turn) title += ' - Turno do ' + ally.char_name;
        else if (this.state === CombatState.foe_turn) title += ' - Turno do ' + foe.monster_name;
        draw_set_halign(fa_center);
        if (this.current_event('dice') === undefined && this.current_event('timing') === undefined && this.current_event('rhythm') === undefined)
        {
            ui_draw_text_shadow((arena.x1 + arena.x2) / 2, arena.y1 + 12, title, c_white);
        }
        draw_set_halign(fa_left);

        const ground_y = arena.y2 - 40;
        const hero_x = lerp(arena.x1, arena.x2, 0.3);
        const foe_x = lerp(arena.x1, arena.x2, 0.7);
        const scale = 4;

        // Avanço rápido na direção do alvo ao atacar
        const hero_offset = Math.sin((20 - this.hero_lunge) / 20 * Math.PI) * ((this.hero_lunge > 0) ? 40 : 0);
        const foe_offset = -Math.sin((20 - this.foe_lunge) / 20 * Math.PI) * ((this.foe_lunge > 0) ? 40 : 0);

        const hero_shake = (this.hero_flash > 0) ? irandom_range(-3, 3) : 0;
        const foe_shake = (this.foe_flash > 0) ? irandom_range(-3, 3) : 0;
        let hero_tint = (this.hero_flash > 0 && Math.floor(this.hero_flash / 4) % 2 === 0) ? c_red : c_white;
        const foe_tint = (this.foe_flash > 0 && Math.floor(this.foe_flash / 4) % 2 === 0) ? c_red : c_white;

        if (this.is_raging) hero_tint = merge_colour(hero_tint, c_orange, 0.35);

        // Firewall um pouco atrás do antivírus, mais ao fundo da arena
        const ally_x = lerp(arena.x1, arena.x2, 0.11);
        const ally_ground_y = ground_y - 30;
        const ally_scale = 3.5;
        const ally_down = (ally.hp <= 0);
        const ally_offset = Math.sin((20 - this.ally_lunge) / 20 * Math.PI) * ((this.ally_lunge > 0) ? 24 : 0);
        const ally_shake = (this.ally_flash > 0) ? irandom_range(-3, 3) : 0;
        let ally_tint = (this.ally_flash > 0 && Math.floor(this.ally_flash / 4) % 2 === 0) ? c_red : (ally_down ? c_gray : c_white);
        if (this.ally_dodging) ally_tint = merge_colour(ally_tint, c_orange, 0.3);

        // Sombras no chão da arena
        draw_set_alpha(0.35);
        draw_set_colour(c_black);
        if (this.ally_in_party) draw_ellipse(ally_x - 44, ally_ground_y - 9, ally_x + 44, ally_ground_y + 7, false);
        draw_ellipse(hero_x - 50, ground_y - 10, hero_x + 50, ground_y + 8, false);
        if (!this.is_boss) draw_ellipse(foe_x - 50, ground_y - 10, foe_x + 50, ground_y + 8, false);
        draw_set_alpha(1);
        draw_set_colour(c_white);

        // Guarda com movimento leve; o golpe sempre começa pelo primeiro quadro
        // Na magia o Firewall solta o fogo pelo cajado (quadros 0 a 3); caído, fica apagado
        const ally_frame = (this.ally_lunge > 0) ? Math.min(3, Math.floor((20 - this.ally_lunge) / 5)) : 0;
        const ally_bob = (this.ally_lunge > 0 || ally_down) ? 0 : -Math.abs(Math.sin(this.anim_time * 0.1 + 1)) * 2;
        if (this.ally_in_party) draw_sprite_ext('spr_firewall_combat_fire', ally_frame, ally_x + ally_offset + ally_shake, ally_ground_y + ally_bob, ally_scale, ally_scale, 0, ally_tint, ally_down ? 0.5 : 1);

        const hero_frame = (this.hero_lunge > 0) ? Math.min(3, Math.floor((20 - this.hero_lunge) / 5)) : 0;
        const hero_bob = (this.hero_lunge > 0) ? 0 : -Math.abs(Math.sin(this.anim_time * 0.12)) * 2;
        draw_sprite_ext('spr_antivirus_combat_axe', hero_frame, hero_x + hero_offset + hero_shake, ground_y + hero_bob, scale, scale, 0, hero_tint, 1);

        const piece_slots = this.is_boss ? this.boss_piece_slots(arena) : [];
        const choosing_target = this.is_boss && (this.state === CombatState.hero_turn || this.state === CombatState.ally_turn) && this.attacks_left > 0 && !busy && this.pieces.length > 1;

        if (this.is_boss)
        {
            // Pedaços do chefe: respira devagar; no ataque mostra o frame da descarga elétrica
            const idle_frames = [0, 1, 2, 4, 5];
            const boss_frame = (this.foe_lunge > 0) ? 3 : idle_frames[Math.floor(this.anim_time / 10) % idle_frames.length];

            // O brilho do sprite é suave: aqui a suavização ajuda
            gpu_set_texfilter(true);
            this.pieces.forEach((piece, i) =>
            {
                const slot = piece_slots[i];
                const piece_shake = (piece.flash > 0 || this.foe_flash > 0) ? irandom_range(-3, 3) : 0;
                const piece_tint = (piece.flash > 0 && Math.floor(piece.flash / 4) % 2 === 0) ? c_red : c_white;
                const piece_x = slot.x + foe_offset * 0.6 + piece_shake;
                const wobble = Math.sin(this.anim_time * 0.06 + i) * 0.01;

                draw_set_alpha(0.35);
                draw_set_colour(c_black);
                draw_ellipse(slot.x - 120 * slot.scale, slot.ground - 24 * slot.scale, slot.x + 120 * slot.scale, slot.ground + 18 * slot.scale, false);
                draw_set_alpha(1);
                draw_sprite_ext('spr_ddos', boss_frame, piece_x, slot.ground, slot.scale + wobble, slot.scale - wobble, 0, piece_tint, 1);

                // Usado pelos números flutuantes
                piece.draw_x = slot.x;
                piece.draw_top = slot.y1;
            });
            gpu_set_texfilter(false);

            // Vida de cada pedaço
            this.pieces.forEach((piece, i) =>
            {
                const slot = piece_slots[i];
                const mini_width = clamp(300 * slot.scale, 56, 110);
                ui_draw_bar(slot.x - mini_width / 2, slot.y1 - 8, mini_width, 8, piece.hp, piece.hp_max, c_fuchsia);
                draw_set_halign(fa_center);
                ui_draw_text_shadow(slot.x, slot.y1 - 30, piece.hp + '/' + piece.hp_max, c_white);
                draw_set_halign(fa_left);
            });

            // Mira: seta em cima do pedaço escolhido
            if (choosing_target)
            {
                const slot = piece_slots[this.target_index];
                const bounce = Math.abs(Math.sin(this.anim_time * 0.15)) * 6;
                const arrow_y = slot.y1 - 40 - bounce;
                draw_set_colour(c_yellow);
                draw_triangle(slot.x - 10, arrow_y - 14, slot.x + 10, arrow_y - 14, slot.x, arrow_y);
                draw_set_alpha(0.5 + 0.3 * Math.sin(this.anim_time * 0.2));
                draw_rectangle(slot.x1, slot.y1, slot.x2, slot.y2, true);
                draw_set_alpha(1);
                draw_set_colour(c_white);
            }
        }
        else if (foe.hp > 0 || this.state !== CombatState.victory)
        {
            // No golpe usa o sprite de ataque (se o inimigo tiver um), do primeiro ao último quadro
            let foe_sprite = foe.combat_sprite_idle;
            let foe_frame = Math.floor(this.anim_time / 8) % sprite_get_number(foe_sprite);
            if (this.foe_lunge > 0 && foe.combat_sprite_attack !== undefined)
            {
                foe_sprite = foe.combat_sprite_attack;
                foe_frame = Math.min(sprite_get_number(foe_sprite) - 1, Math.floor((20 - this.foe_lunge) / 5));
            }
            // Cavalo de Troia roubando: o compartimento abre e fecha
            if (this.is_trojan && this.foe_hatch > 0)
            {
                foe_sprite = 'spr_cavalo_troia_summon';
                foe_frame = Math.min(sprite_get_number(foe_sprite) - 1, Math.floor((40 - this.foe_hatch) / 10));
            }
            draw_sprite_ext(foe_sprite, foe_frame, foe_x + foe_offset + foe_shake, ground_y, foe.combat_scale, foe.combat_scale, 0, foe_tint, 1);
        }

        // Nomes e barras de vida (as do grupo são mais estreitas para caberem lado a lado)
        const bar_width = 200;
        const party_bar_width = this.ally_in_party ? 140 : bar_width;
        const hero_top = ground_y - sprite_get_height('spr_antivirus_combat_axe') * scale;
        const ally_top = ally_ground_y - sprite_get_height('spr_firewall_combat_fire') * ally_scale;
        const foe_top = ground_y - (this.is_boss ? 100 : foe.combat_bar_offset);

        draw_set_halign(fa_center);
        ui_draw_text_shadow(hero_x, hero_top - 64, ((this.ally_in_party && this.state === CombatState.hero_turn) ? '> ' : '') + hero.char_name, this.hero_colour);
        ui_draw_bar(hero_x - party_bar_width / 2, hero_top - 42, party_bar_width, 14, hero.hp, hero.get_hp_max(), c_lime);
        ui_draw_text_shadow(hero_x, hero_top - 26, hero.hp + '/' + hero.get_hp_max() + ' PV  CA ' + hero.armor_class, c_white);

        if (this.ally_in_party)
        {
            ui_draw_text_shadow(ally_x, ally_top - 64, ((this.state === CombatState.ally_turn) ? '> ' : '') + ally.char_name + (ally_down ? ' (caído)' : ''), ally_down ? c_gray : this.ally_colour);
            ui_draw_bar(ally_x - party_bar_width / 2, ally_top - 42, party_bar_width, 14, ally.hp, ally.get_hp_max(), c_lime);
            ui_draw_text_shadow(ally_x, ally_top - 26, ally.hp + '/' + ally.get_hp_max() + ' PV  CA ' + ally.armor_class, c_white);
        }

        if (this.is_boss)
        {
            // Vida somada de todos os pedaços, no alto da arena
            const boss_bar_y = arena.y1 + 44;
            const pieces_text = (this.pieces.length === 1) ? '' : '  x' + this.pieces.length;
            ui_draw_text_shadow(foe_x, boss_bar_y - 4, foe.monster_name + pieces_text, this.foe_colour);
            ui_draw_bar(foe_x - bar_width / 2, boss_bar_y + 18, bar_width, 14, this.boss_total_hp(), foe.hp_max, c_red);
            ui_draw_text_shadow(foe_x, boss_bar_y + 34, this.boss_total_hp() + '/' + foe.hp_max + ' PV   CA ' + foe.armor_class, c_white);
        }
        else
        {
            ui_draw_text_shadow(foe_x, foe_top - 64, foe.monster_name, this.foe_colour);
            ui_draw_bar(foe_x - bar_width / 2, foe_top - 42, bar_width, 14, foe.hp, foe.hp_max, c_red);
            ui_draw_text_shadow(foe_x, foe_top - 26, foe.hp + '/' + foe.hp_max + ' PV   CA ' + foe.armor_class, c_white);

            // Cavalo de Troia: o que ele está carregando agora e o que está usando
            if (this.is_trojan)
            {
                // Embaixo do cavalo, numa linha só: o que está com ele e quando vem o próximo roubo
                const stolen_names = this.stolen.map((key) => trojan_ability_short_name(key));
                let stolen_text = 'Roubou: ' + ((stolen_names.length === 0) ? 'nada (ainda)' : stolen_names.join(', '));
                const next_steal = TROJAN_STEAL_EVERY - (this.trojan_turns % TROJAN_STEAL_EVERY);
                stolen_text += '   Próximo roubo: ' + next_steal + ((next_steal === 1) ? ' turno' : ' turnos');
                ui_draw_text_shadow(foe_x, ground_y + 12, stolen_text, this.foe_colour);

                const using = [];
                if (this.trojan_raging) using.push('Em Fúria');
                if (this.trojan_reckless) using.push('Imprudente');
                if (this.trojan_dodging) using.push('Esquivando');
                if (using.length > 0) ui_draw_text_shadow(foe_x, foe_top - 4, using.join(', '), c_orange);
            }
        }

        // Números flutuantes
        for (const popup of this.popups)
        {
            let popup_x = popup.on_ally ? ally_x : (popup.on_hero ? hero_x : foe_x);
            let popup_base = popup.on_ally ? ally_top : (popup.on_hero ? hero_top : foe_top);

            // No chefe o número sai do pedaço atingido (ou do meio do enxame)
            if (!popup.on_hero && !popup.on_ally && this.is_boss)
            {
                if (popup.piece === undefined) popup_base = arena.y1 + 110;
                else
                {
                    popup_x = popup.piece.draw_x;
                    popup_base = popup.piece.draw_top - 20;
                }
            }
            const popup_y = popup_base + 40 - (50 - popup.timer);
            draw_set_alpha(Math.min(1, popup.timer / 15));
            draw_set_colour(c_black);
            draw_text(popup_x + 2, popup_y + 2, popup.text);
            draw_set_colour(popup.colour);
            draw_text(popup_x, popup_y, popup.text);
        }
        draw_set_alpha(1);
        if (choosing_target) ui_draw_text_shadow((arena.x1 + arena.x2) / 2, arena.y2 - line - 6, 'A/D ou setas: mirar   Enter, Espaço ou clique: ' + ((this.pending_actor === ally) ? 'lançar' : 'golpear'), c_yellow);
        else if ((this.state === CombatState.hero_turn || this.state === CombatState.ally_turn) && !busy) ui_draw_text_shadow((arena.x1 + arena.x2) / 2, arena.y2 - line - 6, 'W/S ou setas: escolher   Enter, Espaço ou clique: usar', c_ltgray);
        draw_set_colour(c_white);
        draw_set_halign(fa_left);

        this.draw_sheet(layout);
        this.draw_menu(layout, busy);
        this.draw_log(layout);

        // Rolagem de dados, timing de ataque/defesa e ritmo das chamas por cima da arena
        const dice_event = this.current_event('dice');
        if (dice_event !== undefined) dice_draw_event(dice_event, arena.x1, arena.y1, arena.x2, arena.y2);

        const timing_event = this.current_event('timing');
        if (timing_event !== undefined)
        {
            // A defesa aparece em volta de quem está sendo atacado
            if (this.foe_target === ally)
            {
                const ally_center_y = ally_ground_y - sprite_get_height('spr_firewall_combat_fire') * ally_scale / 2;
                timing_draw_event(timing_event, arena.x1, arena.y1, arena.x2, arena.y2, ally_x, ally_center_y);
            }
            else
            {
                const hero_center_y = ground_y - sprite_get_height('spr_antivirus_combat_axe') * scale / 2;
                timing_draw_event(timing_event, arena.x1, arena.y1, arena.x2, arena.y2, hero_x, hero_center_y);
            }
        }

        const rhythm_event = this.current_event('rhythm');
        if (rhythm_event !== undefined) rhythm_draw_event(rhythm_event, arena.x1, arena.y1, arena.x2, arena.y2);
    }

    /// Ficha de quem está agindo: o bárbaro ou, no turno dele, o Firewall
    draw_sheet(layout)
    {
        const hero = this.hero;
        const ally = this.ally;
        const line = layout.line_height;
        const sheet = layout.sheet;
        ui_draw_panel(sheet.x1, sheet.y1, sheet.x2, sheet.y2);

        const sx = sheet.x1 + 12;
        let sy = sheet.y1 + 10;

        const ability_text = (label, score) => label + ' ' + String(score).padStart(2, ' ') + '(' + format_modifier(ability_modifier(score)) + ')';

        if (this.state === CombatState.ally_turn)
        {
            // Ficha do Firewall
            draw_set_colour(this.ally_colour);
            draw_text(sx, sy, ally.char_name.toUpperCase());
            draw_set_colour(c_ltgray);
            draw_text(sx, sy + line, ally.char_class);
            draw_set_colour(c_white);
            sy += line * 2 + 4;

            ui_draw_bar(sx, sy + 3, 120, 12, ally.hp, ally.get_hp_max(), c_lime);
            draw_text(sx + 130, sy, 'PV ' + ally.hp + '/' + ally.get_hp_max());
            sy += line;
            draw_text(sx, sy, 'CA ' + ally.armor_class + '   Proficiência ' + format_modifier(ally.proficiency_bonus));
            sy += line + 4;

            draw_text(sx, sy, ability_text('FOR', ally.strength) + ' ' + ability_text('DES', ally.dexterity) + ' ' + ability_text('CON', ally.constitution));
            sy += line;
            draw_text(sx, sy, ability_text('INT', ally.intelligence) + ' ' + ability_text('SAB', ally.wisdom) + ' ' + ability_text('CAR', ally.charisma));
            sy += line + 6;

            draw_set_colour(c_orange);
            draw_text(sx, sy, 'Ataque mágico ' + format_modifier(ally.spell_attack_bonus) + '   CD ' + ally.spell_save_dc);
            sy += line;
            draw_text(sx, sy, 'Círculo 1: ' + ally.slots_1 + '/' + ally.slots_1_max + '   Círculo 2: ' + ally.slots_2 + '/' + ally.slots_2_max);
            sy += line + 6;

            draw_set_colour(c_ltgray);
            draw_text(sx, sy, 'Condições:');
            draw_set_colour(this.ally_dodging ? c_yellow : c_gray);
            draw_text(sx + 110, sy, this.ally_dodging ? 'Esquivando' : 'nenhuma');
            sy += line + 6;

            // Itens: tudo de fogo
            draw_set_colour(c_gray);
            for (const item of ally.items)
            {
                let item_text = '- ' + item.name + ((item.short !== '') ? ': ' + item.short : '');
                if (item.name === 'Amuleto de Salamandra' && this.ally_amulet_used) item_text += ' (usado)';
                draw_text(sx, sy, item_text);
                sy += line;
            }
            draw_text(sx, sy, '- Poção de Brasa Viva: ' + ally.potions + '/' + ally.potions_max);
            draw_set_colour(c_white);
            return;
        }

        draw_set_colour(c_aqua);
        draw_text(sx, sy, hero.char_name.toUpperCase());
        draw_set_colour(c_ltgray);
        draw_text(sx, sy + line, hero.char_class);
        draw_set_colour(c_white);
        sy += line * 2 + 4;

        ui_draw_bar(sx, sy + 3, 120, 12, hero.hp, hero.get_hp_max(), c_lime);
        draw_text(sx + 130, sy, 'PV ' + hero.hp + '/' + hero.get_hp_max());
        sy += line;
        draw_text(sx, sy, 'CA ' + hero.armor_class + '   Proficiência ' + format_modifier(hero.proficiency_bonus));
        sy += line + 4;

        draw_text(sx, sy, ability_text('FOR', hero.strength) + ' ' + ability_text('DES', hero.dexterity) + ' ' + ability_text('CON', hero.constitution));
        sy += line;
        draw_text(sx, sy, ability_text('INT', hero.intelligence) + ' ' + ability_text('SAB', hero.wisdom) + ' ' + ability_text('CAR', hero.charisma));
        sy += line + 8;

        draw_set_colour(c_orange);
        draw_text(sx, sy, 'Fúrias: ' + hero.rage_uses + '/' + hero.rage_uses_max);
        draw_set_colour((hero.exhaustion > 0) ? c_red : c_white);
        draw_text(sx + 160, sy, 'Exaustão: ' + hero.exhaustion);
        draw_set_colour(c_white);
        sy += line + 4;

        const conditions = [];
        if (this.is_raging) conditions.push('Em Fúria (' + this.rage_rounds_left + ' rodadas)');
        if (this.is_frenzied) conditions.push('Frenesi');
        if (this.reckless_active) conditions.push('Imprudente');
        if (this.is_dodging) conditions.push('Esquivando');

        draw_set_colour(c_ltgray);
        draw_text(sx, sy, 'Condições:');
        draw_set_colour(c_yellow);
        if (conditions.length === 0)
        {
            draw_set_colour(c_gray);
            draw_text(sx + 110, sy, 'nenhuma');
        }
        conditions.forEach((condition, i) => draw_text(sx + 110, sy + i * line, condition));
        sy += Math.max(1, conditions.length) * line + 8;

        draw_set_colour(c_gray);
        draw_text(sx, sy, 'Passivas:');
        if (this.is_trojan && this.trojan_has('defense'))
        {
            draw_set_colour(this.foe_colour);
            draw_text(sx, sy + line, '- Defesa sem Armadura [ROUBADA]');
            draw_set_colour(c_gray);
        }
        else draw_text(sx, sy + line, '- Defesa sem Armadura (CA ' + hero.armor_class + ')');
        draw_text(sx, sy + line * 2, '- Sentido de Perigo');
        draw_set_colour(c_white);
    }

    /// Menu de ações, escolha de alvo no chefe ou resultado da luta
    draw_menu(layout, busy)
    {
        const line = layout.line_height;
        const menu = layout.menu;
        ui_draw_panel(menu.x1, menu.y1, menu.x2, menu.y2);

        const mx = menu.x1 + 12;
        const my = menu.y1 + 10;
        const choosing = (this.state === CombatState.hero_turn || this.state === CombatState.ally_turn);

        if (choosing && this.attacks_left > 0)
        {
            // Chefe: escolhendo o alvo dos golpes (ou do fogo do Firewall)
            const by_ally = (this.pending_actor === this.ally);
            draw_set_colour(c_yellow);
            draw_text(mx, my, (by_ally ? 'FOGO ' : 'GOLPE ') + (this.attacks_total - this.attacks_left + 1) + ' DE ' + this.attacks_total);
            draw_set_colour(c_ltgray);
            draw_text_ext(mx, my + line + 12, 'Escolha qual pedaço do ' + this.foe.monster_name + ' vai levar ' + (by_ally ? 'este fogo.' : 'este golpe.') + ' Derrubar um pedaço de vez impede que ele se divida de novo; bater no maior diminui os próximos pedaços.', line, menu.x2 - mx - 12);
            draw_set_colour(c_white);
        }
        else if (choosing)
        {
            const is_ally_turn = (this.state === CombatState.ally_turn);
            draw_set_colour(is_ally_turn ? this.ally_colour : c_aqua);
            draw_text(mx, my, is_ally_turn ? this.ally.char_name.toUpperCase() : 'SUAS AÇÕES');
            draw_set_colour(this.action_used ? c_gray : c_lime);
            draw_text(mx + 130, my, this.action_used ? '[Ação usada]' : '[Ação]');
            draw_set_colour(this.bonus_used ? c_gray : c_lime);
            draw_text(mx + 270, my, this.bonus_used ? '[Bônus usada]' : '[Ação Bônus]');
            draw_set_colour(c_white);

            this.menu_items.forEach((item, i) =>
            {
                const item_y = layout.menu_first_y + i * layout.menu_line_height;
                const selected = (i === this.menu_index) && !busy;

                if (selected)
                {
                    draw_set_alpha(0.35);
                    draw_set_colour(is_ally_turn ? this.ally_colour : c_aqua);
                    draw_rectangle(menu.x1 + 8, item_y - 3, menu.x2 - 8, item_y + layout.menu_line_height - 4, false);
                    draw_set_alpha(1);
                }

                draw_set_colour((item.enabled && !busy) ? c_white : c_dkgray);
                draw_text(mx, item_y, (selected ? '> ' : '  ') + item.label);

                draw_set_halign(fa_right);
                draw_set_colour((item.enabled && !busy) ? c_ltgray : c_dkgray);
                draw_text(menu.x2 - 16, item_y, item.cost);
                draw_set_halign(fa_left);
            });

            // Descrição da opção selecionada
            if (this.menu_items.length > 0 && !busy)
            {
                const desc_y = layout.menu_first_y + this.menu_items.length * layout.menu_line_height + 8;
                draw_set_colour(UI_BORDER);
                draw_line(menu.x1 + 8, desc_y - 4, menu.x2 - 8, desc_y - 4);
                draw_set_colour(c_ltgray);
                draw_text_ext(mx, desc_y, this.menu_items[this.menu_index].description, line, menu.x2 - mx - 12);
            }
        }
        else if (this.state === CombatState.foe_turn || this.state === CombatState.intro)
        {
            draw_set_colour(c_gray);
            draw_text(mx, my, (this.state === CombatState.intro) ? 'Rolando iniciativa...' : 'O ' + this.foe.monster_name + ' está agindo...');
        }
        else
        {
            let result_text = '';
            let result_colour = c_white;
            switch (this.state)
            {
                case CombatState.victory: result_text = 'VITÓRIA!'; result_colour = c_lime; break;
                case CombatState.defeat: result_text = 'DERROTA'; result_colour = c_red; break;
                case CombatState.fled: result_text = 'VOCÊ FUGIU'; result_colour = c_ltgray; break;
            }

            draw_set_halign(fa_center);
            draw_set_colour(result_colour);
            draw_text_transformed((menu.x1 + menu.x2) / 2, menu.y1 + 60, result_text, 3, 3, 0);
            draw_set_colour(c_white);
            draw_text((menu.x1 + menu.x2) / 2, menu.y1 + 160, (this.state === CombatState.defeat) ? 'Enter: recomeçar' : 'Enter: continuar');
            draw_set_halign(fa_left);
        }

        draw_set_colour(c_white);
    }

    /// Registro de combate: as mensagens mais novas embaixo
    draw_log(layout)
    {
        const line = layout.line_height;
        const log = layout.log;
        ui_draw_panel(log.x1, log.y1, log.x2, log.y2);

        draw_set_colour(c_ltgray);
        draw_text(log.x1 + 12, log.y1 + 10, 'REGISTRO DE COMBATE');

        const log_width = log.x2 - log.x1 - 24;
        const log_top = log.y1 + 10 + line + 8;
        let log_y = log.y2 - 10;

        // Desenha de baixo para cima
        for (let i = this.log_entries.length - 1; i >= 0; i--)
        {
            const entry = this.log_entries[i];
            log_y -= string_height_ext(entry.text, line, log_width) + 4;
            if (log_y < log_top) break;

            draw_set_colour(entry.colour);
            draw_text_ext(log.x1 + 12, log_y, entry.text, line, log_width);
        }

        draw_set_colour(c_white);
    }
}

OBJECTS.obj_combat = Combat;
