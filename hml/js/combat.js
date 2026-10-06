'use strict';
// Combate por turnos (obj_combat): Bárbaro 3 Berserker contra o vírus

class Combat
{
    /// hero: o Player, foe: o Slime que encostou
    constructor(hero, foe)
    {
        this.hero = hero;
        this.foe = foe;

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

        this.hero_colour = c_aqua;
        this.foe_colour = make_colour_rgb(200, 140, 255);
        this.hit_colour = make_colour_rgb(255, 120, 120);

        // Animação
        this.anim_time = 0;
        this.hero_lunge = 0;
        this.foe_lunge = 0;
        this.hero_flash = 0;
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

    add_popup(on_hero, text, colour)
    {
        this.popups.push({ on_hero, text, colour, timer: 50 });
    }

    // ------------------------------------------------------------ Fila de eventos

    queue_log(text, colour = c_white) { this.event_queue.push({ type: 'log', text, colour }); }
    queue_popup(on_hero, text, colour) { this.event_queue.push({ type: 'popup', on_hero, text, colour }); }
    queue_lunge(on_hero) { this.event_queue.push({ type: 'lunge', on_hero }); }
    queue_damage(on_hero, amount) { this.event_queue.push({ type: 'damage', on_hero, amount }); }
    queue_wait(frames) { this.event_queue.push({ type: 'wait', frames }); }
    queue_dice(dice_event) { this.event_queue.push(dice_event); }

    /// Minijogo de timing; quando termina, resolve_timing decide o que vem depois (rolagens, dano)
    queue_timing(kind, data) { this.event_queue.push(timing_event_create(kind, data)); }

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

                        // O que o resultado gera (rolagens, dano) entra na frente do resto da fila
                        const rest = this.event_queue;
                        this.event_queue = [];
                        this.resolve_timing(event);
                        this.event_queue = this.event_queue.concat(rest);
                    }
                    return true;

                case 'wait':
                    event.frames -= 1;
                    if (event.frames <= 0) this.event_queue.splice(0, 1);
                    return true;

                case 'log':
                    this.add_log(event.text, event.colour);
                    break;

                case 'popup':
                    this.add_popup(event.on_hero, event.text, event.colour);
                    break;

                case 'lunge':
                    if (event.on_hero) this.hero_lunge = 20;
                    else this.foe_lunge = 20;
                    break;

                case 'damage':
                    if (event.on_hero) this.damage_hero(event.amount);
                    else this.damage_foe(event.amount);
                    break;
            }

            // finish_combat pode ter esvaziado a fila
            if (this.event_queue.length > 0 && this.event_queue[0] === event) this.event_queue.splice(0, 1);
        }

        return false;
    }

    current_dice_event()
    {
        const e = this.event_queue[0];
        return (e && e.type === 'dice' && e.timer !== undefined) ? e : undefined;
    }

    current_timing_event()
    {
        const e = this.event_queue[0];
        return (e && e.type === 'timing' && e.timer !== undefined) ? e : undefined;
    }

    resolve_timing(event)
    {
        const texts = timing_result_text(event);
        this.queue_log('Timing: ' + texts[0] + ' (' + texts[1] + ')', (event.result === TimingResult.miss) ? c_ltgray : DICE_COLOUR_TIMING);

        switch (event.kind)
        {
            case 'attack':
                this.hero_attack_roll(event.data.source, event.result);
                break;

            case 'defend':
                if (event.data.attack === 'acid_spit') this.foe_acid_spit_resolve(event.result);
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

        // Iniciativa: d20 + Destreza (exaustão 1+ dá desvantagem em testes de atributo)
        const hero_init_disadvantage = hero.exhaustion >= 1;
        const hero_init_bonus = ability_modifier(hero.dexterity);
        const hero_init = roll_d20(false, hero_init_disadvantage);
        const hero_init_total = hero_init.natural + hero_init_bonus;

        const foe_init_bonus = ability_modifier(foe.dexterity);
        const foe_init = roll_d20(false, false);
        const foe_init_total = foe_init.natural + foe_init_bonus;

        // Empate: vence quem tem mais Destreza
        const hero_first = (hero_init_total > foe_init_total || (hero_init_total === foe_init_total && hero.dexterity >= foe.dexterity));
        this.turn_order = hero_first ? [hero, foe] : [foe, hero];

        this.add_log('Um ' + foe.monster_name + ' ataca! Rolando iniciativa...', c_white);

        const hero_init_event = dice_event_create('Iniciativa: ' + hero.char_name, this.hero_colour);
        hero_init_event.mode_text = roll_mode_text(false, hero_init_disadvantage, '', 'Exaustão');
        hero_init_event.fast = true;
        dice_event_add_d20(hero_init_event, hero_init, DICE_COLOUR_HERO, DICE_TEXT_DARK);
        dice_event_add_modifier(hero_init_event, hero_init_bonus, 'Destreza');
        hero_init_event.total = hero_init_total;
        this.queue_dice(hero_init_event);
        this.queue_log('Você: ' + hero_init.text + format_modifier(hero_init_bonus) + ' = ' + hero_init_total, this.hero_colour);

        const foe_init_event = dice_event_create('Iniciativa: ' + foe.monster_name, this.foe_colour);
        foe_init_event.fast = true;
        dice_event_add_d20(foe_init_event, foe_init, DICE_COLOUR_FOE, c_white);
        dice_event_add_modifier(foe_init_event, foe_init_bonus, 'Destreza');
        foe_init_event.total = foe_init_total;
        foe_init_event.verdict = hero_first ? 'Você age primeiro!' : 'O ' + foe.monster_name + ' age primeiro!';
        foe_init_event.verdict_colour = hero_first ? this.hero_colour : this.foe_colour;
        this.queue_dice(foe_init_event);
        this.queue_log(foe.monster_name + ': ' + foe_init.text + format_modifier(foe_init_bonus) + ' = ' + foe_init_total, this.foe_colour);
    }

    begin_turn()
    {
        if (this.turn_order[this.turn_index] === this.hero)
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

    finish_combat(result)
    {
        this.event_queue = [];

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
        switch (this.state)
        {
            case CombatState.victory:
                this.hero.encounter_cooldown = 60;
                instance_destroy(this.foe);
                game.combat = null;
                break;

            case CombatState.fled:
                this.hero.encounter_cooldown = 120;
                this.foe.stun_timer = 180;
                this.foe.is_chasing = false;
                game.combat = null;
                break;

            case CombatState.defeat:
                room_restart();
                break;
        }
    }

    // ------------------------------------------------------------ Dano (aplicado pela fila, depois da animação dos dados)

    damage_foe(amount)
    {
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

        // Antes do golpe: timing no tempo certo aumenta o dano
        this.queue_timing('attack', { source });
    }

    hero_attack_roll(source, timing)
    {
        const hero = this.hero;
        const foe = this.foe;
        const disadvantage = hero.exhaustion >= 3;
        const strength_mod = ability_modifier(hero.strength);
        const attack_bonus = strength_mod + hero.proficiency_bonus;
        const roll = roll_d20(this.reckless_active, disadvantage);
        const total = roll.natural + attack_bonus;
        const is_critical = (roll.natural === 20);
        const hit = is_critical || (roll.natural !== 1 && total >= foe.armor_class);

        // Jogada de ataque
        const attack_event = dice_event_create(hero.char_name + ': ' + source, this.hero_colour);
        attack_event.target_text = 'vs CA ' + foe.armor_class;
        attack_event.mode_text = roll_mode_text(this.reckless_active, disadvantage, 'Ataque Imprudente', 'Exaustão');
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

        damage_event.total = damage;
        damage_event.total_label = 'cortante';

        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + damage_text + ' = ' + damage + ' cortante.', c_yellow);
        this.queue_damage(false, damage);
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
            this.is_frenzied = false;
            this.hero.exhaustion = Math.min(6, this.hero.exhaustion + 1);
            this.hero.hp = Math.min(this.hero.hp, this.hero.get_hp_max());
            this.add_log('O Frenesi cobra seu preço: exaustão nível ' + this.hero.exhaustion + '.', c_orange);
        }
    }

    // ------------------------------------------------------------ Ações do vírus

    foe_act()
    {
        const foe = this.foe;

        // Recarga 5-6 no início do turno
        if (!foe.acid_spit_ready)
        {
            const recharge = roll_dice(1, 6);
            foe.acid_spit_ready = (recharge.total >= 5);

            const recharge_event = dice_event_create(foe.monster_name + ': recarga do Cuspe Ácido', this.foe_colour);
            recharge_event.target_text = 'precisa de 5+';
            recharge_event.fast = true;
            dice_event_add_roll(recharge_event, recharge, DICE_COLOUR_FOE, c_white);
            recharge_event.total = recharge.total;
            recharge_event.verdict = foe.acid_spit_ready ? 'PRONTO!' : 'AINDA NÃO';
            recharge_event.verdict_colour = foe.acid_spit_ready ? this.hit_colour : c_ltgray;

            this.queue_dice(recharge_event);
            this.queue_log('Recarga do Cuspe Ácido: ' + recharge.text + (foe.acid_spit_ready ? ' -> pronto!' : ' -> ainda não.'), this.foe_colour);
        }

        if (foe.acid_spit_ready && irandom(1) === 0) this.foe_acid_spit();
        else this.foe_pseudopod();
    }

    foe_pseudopod()
    {
        // Antes do golpe: o jogador tenta defender no tempo certo
        this.queue_log('O ' + this.foe.monster_name + ' avança com o pseudópode. Defenda!', this.foe_colour);
        this.queue_timing('defend', { attack: 'pseudopod' });
    }

    foe_pseudopod_resolve(timing)
    {
        const hero = this.hero;
        const foe = this.foe;
        const roll = roll_d20(this.reckless_active, this.is_dodging);
        const total = roll.natural + foe.attack_bonus;
        const is_critical = (roll.natural === 20);
        const hit = is_critical || (roll.natural !== 1 && total >= hero.armor_class);

        const attack_event = dice_event_create(foe.monster_name + ': Pseudópode', this.foe_colour);
        attack_event.target_text = 'vs CA ' + hero.armor_class;
        attack_event.mode_text = roll_mode_text(this.reckless_active, this.is_dodging, 'você está Imprudente', 'você está Esquivando');
        dice_event_add_d20(attack_event, roll, DICE_COLOUR_FOE, c_white);
        dice_event_add_modifier(attack_event, foe.attack_bonus, 'Ataque');
        attack_event.total = total;
        attack_event.verdict = is_critical ? 'CRÍTICO!' : (hit ? 'ACERTOU!' : 'ERROU');
        attack_event.verdict_colour = hit ? this.hit_colour : c_lime;

        this.queue_lunge(false);
        this.queue_dice(attack_event);

        const text = 'Pseudópode: ' + roll.text + format_modifier(foe.attack_bonus) + ' = ' + total + ' vs CA ' + hero.armor_class;

        if (!hit)
        {
            this.queue_log(text + ' -> ERROU.', c_ltgray);
            this.queue_popup(true, 'Errou', c_ltgray);
            return;
        }

        this.queue_log(text + (is_critical ? ' -> CRÍTICO!' : ' -> ACERTOU!'), this.hit_colour);

        const bludgeon = roll_dice(is_critical ? 2 : 1, 6);
        const acid = roll_dice(is_critical ? 4 : 2, 6);
        let bludgeon_damage = bludgeon.total + foe.pseudopod_bonus;
        let damage_text = bludgeon.text + format_modifier(foe.pseudopod_bonus) + ' contundente';

        const damage_event = dice_event_create('Dano: Pseudópode', this.hit_colour);
        damage_event.mode_text = is_critical ? 'CRÍTICO: dados de dano dobrados' : '';
        dice_event_add_roll(damage_event, bludgeon, DICE_COLOUR_BLUDGEONING, DICE_TEXT_DARK);
        dice_event_add_roll(damage_event, acid, DICE_COLOUR_ACID, c_white);
        dice_event_add_modifier(damage_event, foe.pseudopod_bonus, 'Contundente');

        if (this.is_raging)
        {
            // Resistência: metade do dano contundente (arredondado para baixo)
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
        this.queue_log('Dano: ' + damage_text + ' + ' + acid.text + ' ácido' + ((damage !== raw_damage) ? ', defesa ' + format_modifier(damage - raw_damage) : '') + ' = ' + damage + '.', this.hit_colour);
        this.queue_damage(true, damage);
    }

    foe_acid_spit()
    {
        this.foe.acid_spit_ready = false;

        this.queue_log('O ' + this.foe.monster_name + ' se prepara para cuspir ácido. Defenda!', this.foe_colour);
        this.queue_timing('defend', { attack: 'acid_spit' });
    }

    foe_acid_spit_resolve(timing)
    {
        const hero = this.hero;
        const foe = this.foe;

        // Sentido de Perigo: vantagem em TR de Destreza contra efeitos que você vê
        const disadvantage = hero.exhaustion >= 3;
        const save_bonus = ability_modifier(hero.dexterity);
        const roll = roll_d20(true, disadvantage);
        const total = roll.natural + save_bonus;
        const saved = (total >= foe.acid_spit_dc);

        this.queue_lunge(false);
        this.queue_log('O ' + foe.monster_name + ' cospe ácido! TR de Destreza CD ' + foe.acid_spit_dc + '.', this.hit_colour);

        const save_event = dice_event_create(hero.char_name + ': TR de Destreza (Cuspe Ácido)', this.hero_colour);
        save_event.target_text = 'vs CD ' + foe.acid_spit_dc;
        save_event.mode_text = roll_mode_text(true, disadvantage, 'Sentido de Perigo', 'Exaustão');
        dice_event_add_d20(save_event, roll, DICE_COLOUR_HERO, DICE_TEXT_DARK);
        dice_event_add_modifier(save_event, save_bonus, 'Destreza');
        save_event.total = total;
        save_event.verdict = saved ? 'SUCESSO' : 'FALHOU';
        save_event.verdict_colour = saved ? c_lime : this.hit_colour;

        this.queue_dice(save_event);
        this.queue_log(roll.text + format_modifier(save_bonus) + ' = ' + total + (saved ? ' -> SUCESSO, metade do dano.' : ' -> FALHOU.'), saved ? c_ltgray : this.hit_colour);

        const dice = roll_dice(2, 6);
        let damage = dice.total;

        const damage_event = dice_event_create('Dano: Cuspe Ácido', this.hit_colour);
        dice_event_add_roll(damage_event, dice, DICE_COLOUR_ACID, c_white);

        if (saved)
        {
            damage = Math.floor(dice.total / 2);
            dice_event_add_modifier(damage_event, damage - dice.total, 'Metade (TR)');
        }

        const before_defense = damage;
        damage = this.apply_timing_defense(damage_event, damage, timing);
        damage_event.total = damage;
        damage_event.total_label = 'ácido';

        this.queue_dice(damage_event);
        this.queue_log('Dano: ' + dice.text + ' ácido' + (saved ? ', metade' : '') + ((damage !== before_defense) ? ', defesa ' + format_modifier(damage - before_defense) : '') + ' = ' + damage + '.', this.hit_colour);
        this.queue_damage(true, damage);
    }

    // ------------------------------------------------------------ Menu

    build_menu()
    {
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
                + ' em Fúria). 20 natural é crítico: dados de dano dobrados. Antes do golpe, acerte o tempo: +1d'
                + TIMING_ATTACK_PERFECT_DIE + ' de dano (perfeito) ou +' + TIMING_ATTACK_GOOD_BONUS + ' (bom).',
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

        return items;
    }

    hero_has_options()
    {
        return this.menu_items.some((item) => item.enabled && item.key !== 'end' && item.key !== 'reckless');
    }

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

            case 'end':
                this.hero_end_turn();
                break;
        }
    }

    // ------------------------------------------------------------ Step: fluxo de turnos e entrada do jogador

    step()
    {
        this.anim_time += 1;
        this.hero_lunge = Math.max(0, this.hero_lunge - 1);
        this.foe_lunge = Math.max(0, this.foe_lunge - 1);
        this.hero_flash = Math.max(0, this.hero_flash - 1);
        this.foe_flash = Math.max(0, this.foe_flash - 1);

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
            {
                this.menu_items = this.build_menu();

                if (!this.hero_has_options())
                {
                    this.hero_end_turn();
                    break;
                }

                const count = this.menu_items.length;
                this.menu_index = clamp(this.menu_index, 0, count - 1);

                if (keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W'))) this.menu_index = (this.menu_index - 1 + count) % count;
                if (keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S'))) this.menu_index = (this.menu_index + 1) % count;

                // Mouse: passar por cima seleciona, clicar confirma
                const layout = this.get_layout();
                const mouse_x = device_mouse_x_to_gui();
                const mouse_y = device_mouse_y_to_gui();
                const mouse_moved = (mouse_x !== this.mouse_last_x || mouse_y !== this.mouse_last_y);
                this.mouse_last_x = mouse_x;
                this.mouse_last_y = mouse_y;

                for (let index = 0; index < count; index++)
                {
                    const item_y = layout.menu_first_y + index * layout.menu_line_height;
                    if (point_in_rectangle(mouse_x, mouse_y, layout.menu.x1 + 8, item_y - 3, layout.menu.x2 - 8, item_y + layout.menu_line_height - 4))
                    {
                        if (mouse_moved) this.menu_index = index;
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

    // ------------------------------------------------------------ Draw GUI: tela de combate

    draw_gui()
    {
        const hero = this.hero;
        const foe = this.foe;
        const layout = this.get_layout();
        const line = layout.line_height;
        const busy = this.event_queue.length > 0 || this.wait_timer > 0;

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        // Escurece o mapa por trás
        draw_set_alpha(0.8);
        draw_set_colour(c_black);
        draw_rectangle(0, 0, layout.width, layout.height, false);
        draw_set_alpha(1);
        draw_set_colour(c_white);

        // ---------------- Arena

        const arena = layout.arena;
        // Fundo animado (10 quadros por segundo), recortado na proporção da arena para não esticar
        const arena_w = arena.x2 - arena.x1;
        const arena_h = arena.y2 - arena.y1;
        const bg_w = sprite_get_width('spr_combat_bg');
        const bg_h = Math.min(sprite_get_height('spr_combat_bg'), bg_w * arena_h / arena_w);
        const bg_top = (sprite_get_height('spr_combat_bg') - bg_h) * 0.3;
        const bg_frame = Math.floor(performance.now() / 100) % sprite_get_number('spr_combat_bg');
        draw_sprite_part_ext('spr_combat_bg', bg_frame, 0, bg_top, bg_w, bg_h, arena.x1, arena.y1, arena_w / bg_w, arena_h / bg_h, c_white, 1);
        draw_set_colour(UI_BORDER);
        draw_rectangle(arena.x1, arena.y1, arena.x2, arena.y2, true);
        draw_set_colour(c_white);

        let title = 'COMBATE - Rodada ' + this.round_number;
        if (this.state === CombatState.hero_turn) title += ' - Seu turno';
        else if (this.state === CombatState.foe_turn) title += ' - Turno do ' + foe.monster_name;
        draw_set_halign(fa_center);
        if (this.current_dice_event() === undefined && this.current_timing_event() === undefined) ui_draw_text_shadow((arena.x1 + arena.x2) / 2, arena.y1 + 12, title, c_white);
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

        // Sombras no chão da arena
        draw_set_alpha(0.35);
        draw_set_colour(c_black);
        draw_ellipse(hero_x - 50, ground_y - 10, hero_x + 50, ground_y + 8, false);
        draw_ellipse(foe_x - 50, ground_y - 10, foe_x + 50, ground_y + 8, false);
        draw_set_alpha(1);
        draw_set_colour(c_white);

        // Guarda com movimento leve; o golpe sempre começa pelo primeiro quadro
        const hero_frame = (this.hero_lunge > 0) ? Math.min(3, Math.floor((20 - this.hero_lunge) / 5)) : 0;
        const hero_bob = (this.hero_lunge > 0) ? 0 : -Math.abs(Math.sin(this.anim_time * 0.12)) * 2;
        draw_sprite_ext('spr_antivirus_combat_axe', hero_frame, hero_x + hero_offset + hero_shake, ground_y + hero_bob, scale, scale, 0, hero_tint, 1);

        if (foe.hp > 0 || this.state !== CombatState.victory)
        {
            draw_sprite_ext('spr_virus_left', Math.floor(this.anim_time / 8) % 4, foe_x + foe_offset + foe_shake, ground_y, scale, scale, 0, foe_tint, 1);
        }

        // Nomes e barras de vida
        const bar_width = 200;
        const hero_top = ground_y - sprite_get_height('spr_antivirus_combat_axe') * scale;
        const foe_top = ground_y - 100;

        draw_set_halign(fa_center);
        ui_draw_text_shadow(hero_x, hero_top - 64, hero.char_name, this.hero_colour);
        ui_draw_bar(hero_x - bar_width / 2, hero_top - 42, bar_width, 14, hero.hp, hero.get_hp_max(), c_lime);
        ui_draw_text_shadow(hero_x, hero_top - 26, hero.hp + '/' + hero.get_hp_max() + ' PV   CA ' + hero.armor_class, c_white);

        ui_draw_text_shadow(foe_x, foe_top - 64, foe.monster_name, this.foe_colour);
        ui_draw_bar(foe_x - bar_width / 2, foe_top - 42, bar_width, 14, foe.hp, foe.hp_max, c_red);
        ui_draw_text_shadow(foe_x, foe_top - 26, foe.hp + '/' + foe.hp_max + ' PV   CA ' + foe.armor_class, c_white);

        // Números flutuantes
        for (const popup of this.popups)
        {
            const popup_x = popup.on_hero ? hero_x : foe_x;
            const popup_y = (popup.on_hero ? hero_top : foe_top) + 40 - (50 - popup.timer);
            draw_set_alpha(Math.min(1, popup.timer / 15));
            draw_set_colour(c_black);
            draw_text(popup_x + 2, popup_y + 2, popup.text);
            draw_set_colour(popup.colour);
            draw_text(popup_x, popup_y, popup.text);
        }
        draw_set_alpha(1);
        if (this.state === CombatState.hero_turn && !busy) ui_draw_text_shadow((arena.x1 + arena.x2) / 2, arena.y2 - line - 6, 'W/S ou setas: escolher   Enter, Espaço ou clique: usar', c_ltgray);
        draw_set_colour(c_white);
        draw_set_halign(fa_left);

        // ---------------- Ficha do bárbaro

        const sheet = layout.sheet;
        ui_draw_panel(sheet.x1, sheet.y1, sheet.x2, sheet.y2);

        const sx = sheet.x1 + 12;
        let sy = sheet.y1 + 10;

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

        const ability_text = (label, score) => label + ' ' + String(score).padStart(2, ' ') + '(' + format_modifier(ability_modifier(score)) + ')';
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
        draw_text(sx, sy + line, '- Defesa sem Armadura (CA ' + hero.armor_class + ')');
        draw_text(sx, sy + line * 2, '- Sentido de Perigo');
        draw_set_colour(c_white);

        // ---------------- Menu de ações

        const menu = layout.menu;
        ui_draw_panel(menu.x1, menu.y1, menu.x2, menu.y2);

        const mx = menu.x1 + 12;
        const my = menu.y1 + 10;

        if (this.state === CombatState.hero_turn)
        {
            draw_set_colour(c_aqua);
            draw_text(mx, my, 'SUAS AÇÕES');
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
                    draw_set_colour(c_aqua);
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
            draw_text(mx, my, (this.state === CombatState.intro) ? 'Rolando iniciativa...' : 'O ' + foe.monster_name + ' está agindo...');
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

        // ---------------- Registro

        const log = layout.log;
        ui_draw_panel(log.x1, log.y1, log.x2, log.y2);

        draw_set_colour(c_ltgray);
        draw_text(log.x1 + 12, log.y1 + 10, 'REGISTRO DE COMBATE');

        const log_width = log.x2 - log.x1 - 24;
        const log_top = log.y1 + 10 + line + 8;
        let log_y = log.y2 - 10;

        // Desenha de baixo para cima, as mensagens mais novas embaixo
        for (let i = this.log_entries.length - 1; i >= 0; i--)
        {
            const entry = this.log_entries[i];
            log_y -= string_height_ext(entry.text, line, log_width) + 4;
            if (log_y < log_top) break;

            draw_set_colour(entry.colour);
            draw_text_ext(log.x1 + 12, log_y, entry.text, line, log_width);
        }

        draw_set_colour(c_white);

        // ---------------- Rolagem de dados e timing por cima da arena

        const dice_event = this.current_dice_event();
        if (dice_event !== undefined) dice_draw_event(dice_event, arena.x1, arena.y1, arena.x2, arena.y2);

        const timing_event = this.current_timing_event();
        if (timing_event !== undefined)
        {
            const hero_center_y = ground_y - sprite_get_height('spr_antivirus_combat_axe') * scale / 2;
            timing_draw_event(timing_event, arena.x1, arena.y1, arena.x2, arena.y2, hero_x, hero_center_y);
        }
    }
}
