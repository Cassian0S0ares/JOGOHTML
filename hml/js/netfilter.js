'use strict';
// Regras do firewall (obj_netfilter, Room2): Permitir ou Bloquear os pacotes da esteira seguindo a lista de regras

class Netfilter extends Terminal
{
    static object = 'obj_netfilter';

    create()
    {
        super.create();

        // "computer" e "title" vêm de terminal_start()
        this.title ??= 'Regras do Firewall';

        this.waves = netfilter_get_waves();

        // Estados: "briefing" regras da onda, "packet" pacote na esteira, "feedback" qual regra decidiu, "result" placar final
        this.state = 'briefing';
        this.wave = 0;
        this.packet_index = 0;           // pacote atual dentro da onda
        this.packet_timer = 0;           // frames desde que o pacote entrou na esteira
        this.decision = -1;              // 1 permitir, 0 bloquear, -1 tempo esgotado (o pacote passou)
        this.matched_rule = -1;
        this.correct_count = 0;
        this.error_count = 0;
        this.packet_total = this.waves.reduce((total, wave) => total + wave.packets.length, 0);
        this.selected = 0;               // botão destacado: 0 permitir, 1 bloquear
    }

    current_rules() { return this.waves[this.wave].rules; }
    current_packet() { return this.waves[this.wave].packets[this.packet_index]; }

    /// A regra é nova nesta onda?
    rule_is_new(rule)
    {
        if (this.wave === 0) return false;
        return !this.waves[this.wave - 1].rules.includes(rule);
    }

    /// Retângulos em coordenadas da GUI: regras à esquerda, esteira e botões à direita
    layout()
    {
        const result = terminal_layout(1100, 660);

        const rules_width = 460;
        const number_width = 36;
        let y = result.body_y + 30;

        result.rules = [];
        for (const rule of this.current_rules())
        {
            const height = string_height_ext(rule.text, result.line_height, rules_width - number_width - 16) + 8;
            result.rules.push({
                x1: result.text_x, y1: y, x2: result.text_x + rules_width, y2: y + height,
                text_x: result.text_x + number_width, text_width: rules_width - number_width - 16,
            });
            y += height + 4;
        }

        const right_x1 = result.text_x + rules_width + 24;
        const right_x2 = result.x2 - result.padding;
        result.right_x1 = right_x1;
        result.right_x2 = right_x2;
        result.belt = { x1: right_x1, y1: result.body_y + 30, x2: right_x2, y2: result.body_y + 170 };

        const center_x = (right_x1 + right_x2) / 2;
        const button_y = result.belt.y2 + 20;
        result.buttons = [
            { x1: center_x - 230, y1: button_y, x2: center_x - 12, y2: button_y + 40 },
            { x1: center_x + 12, y1: button_y, x2: center_x + 230, y2: button_y + 40 },
        ];
        result.feedback_y = button_y + 60;

        return result;
    }

    start_wave()
    {
        this.state = 'packet';
        this.packet_index = 0;
        this.packet_timer = 0;
        this.decision = -1;
        this.matched_rule = -1;
        this.idle_timer = 0;
    }

    /// allow: true permitir, false bloquear, undefined tempo esgotado (o pacote passa sem inspeção)
    decide(allow)
    {
        const rules = this.current_rules();
        this.matched_rule = netfilter_first_match(rules, this.current_packet());

        const passed = (allow === undefined) ? true : allow;
        this.decision = (allow === undefined) ? -1 : (allow ? 1 : 0);

        if (allow !== undefined && passed === rules[this.matched_rule].allow) this.correct_count += 1;
        else this.error_count += 1;

        this.state = 'feedback';
        this.idle_timer = 0;
    }

    next_packet()
    {
        this.packet_index += 1;
        this.packet_timer = 0;
        this.decision = -1;
        this.matched_rule = -1;
        this.idle_timer = 0;

        if (this.packet_index < this.waves[this.wave].packets.length)
        {
            this.state = 'packet';
            return;
        }

        this.wave += 1;
        if (this.wave < this.waves.length)
        {
            this.state = 'briefing';
            return;
        }

        this.wave = this.waves.length - 1;
        this.state = 'result';
        if (this.correct_count >= NETFILTER_MIN_CORRECT) terminal_solve(this.computer);
    }

    step()
    {
        this.idle_timer += 1;

        if (this.input_delay > 0)
        {
            this.input_delay -= 1;
            return;
        }

        if (keyboard_check_pressed(vk_escape))
        {
            this.close();
            return;
        }

        const confirm = keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space) || keyboard_check_pressed(ord('E'));
        const click = mouse_check_button_pressed();

        switch (this.state)
        {
            case 'briefing':
                if (confirm || click) this.start_wave();
                break;

            case 'packet':
            {
                this.packet_timer += 1;
                if (this.packet_timer >= this.waves[this.wave].frames)
                {
                    this.decide(undefined);
                    return;
                }

                // Atalhos: A/esquerda/1 permitir, D/direita/2 bloquear
                if (keyboard_check_pressed(ord('1')))
                {
                    this.decide(true);
                    return;
                }
                if (keyboard_check_pressed(ord('2')))
                {
                    this.decide(false);
                    return;
                }
                const move = (keyboard_check_pressed(vk_right) || keyboard_check_pressed(ord('D')))
                    - (keyboard_check_pressed(vk_left) || keyboard_check_pressed(ord('A')));
                if (move !== 0) this.selected = clamp(this.selected + move, 0, 1);

                // Mouse: passar por cima destaca, clicar decide
                let hovered = -1;
                this.layout().buttons.forEach((rect, i) => { if (terminal_mouse_in(rect)) hovered = i; });
                if (this.mouse_moved() && hovered !== -1) this.selected = hovered;

                if (click && hovered !== -1) this.decide(hovered === 0);
                else if (confirm) this.decide(this.selected === 0);
                break;
            }

            case 'feedback':
                if (confirm || click) this.next_packet();
                break;

            case 'result':
                if (confirm || click) this.close();
                break;
        }
    }

    /// Regras, esteira com o pacote, botões, explicação e placar
    draw_gui()
    {
        const layout = this.layout();
        const progress = (this.state === 'result') ? 'Fim' : 'Onda ' + (this.wave + 1) + '/' + this.waves.length + '   Acertos: ' + this.correct_count + ' (meta ' + NETFILTER_MIN_CORRECT + ')';
        terminal_draw_frame(layout, this.title, progress);

        const line_height = layout.line_height;
        const text_x = layout.text_x;
        let hint;

        if (this.state === 'result')
        {
            const good = (this.correct_count >= NETFILTER_MIN_CORRECT);
            let message;
            if (this.error_count === 0) message = 'Firewall perfeito! Nenhum pacote passou por engano. E aquele pacote na porta 4444... alguém aqui dentro está chamando o atacante.';
            else if (good) message = 'Firewall configurado! Alguns pacotes escaparam, mas a rede está de pé. Lembre: a primeira regra que combina decide, e o que não foi liberado é bloqueado.';
            else message = 'Precisa acertar pelo menos ' + NETFILTER_MIN_CORRECT + ' pacotes. Leia as regras de cima para baixo: a primeira que combina com o pacote decide. Tente de novo!';

            terminal_draw_result(layout, this.correct_count + '/' + this.packet_total + ' pacotes certos', good, message);
            hint = 'Enter, Espaço ou clique: fechar';
        }
        else
        {
            const rules = this.current_rules();

            // Regras
            draw_set_colour(c_gray);
            draw_text(text_x, layout.body_y, 'Regras (de cima para baixo, a primeira que combina decide):');

            rules.forEach((rule, i) =>
            {
                const rect = layout.rules[i];
                const matched = (this.state === 'feedback' && i === this.matched_rule);
                const is_new = (this.state === 'briefing' && this.rule_is_new(rule));

                draw_set_colour(matched ? make_colour_rgb(24, 72, 40) : make_colour_rgb(32, 30, 46));
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, false);
                draw_set_colour(matched ? c_lime : (is_new ? c_yellow : UI_BORDER));
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, true);

                draw_set_colour(c_gray);
                draw_text(rect.x1 + 8, rect.y1 + 4, (i + 1) + '.');

                // Cor da ação no fim da regra: verde permitir, laranja bloquear
                let colour = rule.allow ? make_colour_rgb(150, 255, 150) : make_colour_rgb(255, 180, 120);
                if (this.state === 'feedback' && !matched) colour = merge_colour(colour, c_black, 0.4);
                draw_set_colour(colour);
                draw_text_ext(rect.text_x, rect.y1 + 4, rule.text, line_height, rect.text_width);

                if (is_new)
                {
                    draw_set_halign(fa_right);
                    draw_set_colour(c_yellow);
                    draw_text(rect.x2 - 6, rect.y2 - line_height - 2, 'NOVA');
                    draw_set_halign(fa_left);
                }
            });

            const right_x1 = layout.right_x1;
            const right_width = layout.right_x2 - right_x1;

            if (this.state === 'briefing')
            {
                draw_set_colour(c_aqua);
                draw_text(right_x1, layout.body_y + 30, 'ONDA ' + (this.wave + 1));
                draw_set_colour(c_white);

                let text;
                switch (this.wave)
                {
                    case 0: text = 'Os pacotes vão passar pela esteira. Para cada um, decida: PERMITIR ou BLOQUEAR, seguindo as regras ao lado.\n\nSe o tempo acabar, o pacote passa sem inspeção!'; break;
                    case 1: text = 'Regras novas no topo da lista (em amarelo). Agora a ordem importa: a primeira regra que combina com o pacote é a que vale.'; break;
                    default: text = 'Agora também tem tráfego SAINDO da rede. Um programa infectado aqui dentro pode tentar falar com o atacante lá fora.'; break;
                }
                draw_text_ext(right_x1, layout.body_y + 64, text, line_height, right_width);
                hint = 'Enter, Espaço ou clique: começar a onda >';
            }
            else
            {
                const packet = this.current_packet();

                // Esteira
                const belt = layout.belt;
                draw_set_colour(make_colour_rgb(16, 15, 24));
                draw_rectangle(belt.x1, belt.y1, belt.x2, belt.y2, false);
                draw_set_colour(UI_BORDER);
                draw_rectangle(belt.x1, belt.y1, belt.x2, belt.y2, true);

                // Faixas da esteira andando
                const track_y = belt.y2 - 18;
                draw_set_colour(make_colour_rgb(50, 46, 70));
                draw_rectangle(belt.x1 + 4, track_y, belt.x2 - 4, track_y + 12, false);
                draw_set_colour(make_colour_rgb(80, 74, 110));
                const offset = (this.state === 'packet') ? (this.packet_timer * 2) % 24 : 0;
                for (let stripe_x = belt.x1 + 4 + offset; stripe_x < belt.x2 - 8; stripe_x += 24)
                {
                    draw_line(stripe_x, track_y, stripe_x + 8, track_y + 12);
                }

                // O pacote anda da esquerda até o portão da direita
                const card_width = 250;
                const card_height = 84;
                const progress_belt = (this.state === 'packet') ? this.packet_timer / this.waves[this.wave].frames : 0.5;
                const card_x = lerp(belt.x1 + 12, belt.x2 - card_width - 30, progress_belt);
                const card_y = track_y - card_height - 6;

                draw_set_colour((packet.direction === 'in') ? make_colour_rgb(40, 60, 100) : make_colour_rgb(90, 50, 100));
                draw_rectangle(card_x, card_y, card_x + card_width, card_y + card_height, false);
                draw_set_colour(c_white);
                draw_rectangle(card_x, card_y, card_x + card_width, card_y + card_height, true);
                draw_text_ext(card_x + 10, card_y + 8, netfilter_packet_text(packet), line_height, card_width - 20);

                // Portão: fica vermelho quando o tempo está acabando
                const danger = (this.state === 'packet' && progress_belt > 0.75);
                draw_set_colour(danger ? c_red : UI_BORDER);
                draw_rectangle(belt.x2 - 22, belt.y1 + 10, belt.x2 - 12, track_y, false);

                // Botões
                const labels = ['1) PERMITIR', '2) BLOQUEAR'];
                const correct_button = rules[netfilter_first_match(rules, packet)].allow ? 0 : 1;
                for (let b = 0; b < 2; b++)
                {
                    let colour_button = (b === 0) ? c_lime : c_orange;
                    let highlight;

                    if (this.state === 'packet')
                    {
                        highlight = (b === this.selected);
                    }
                    else
                    {
                        const picked = (this.decision === 1 && b === 0) || (this.decision === 0 && b === 1);
                        colour_button = c_gray;
                        if (b === correct_button) colour_button = c_lime;
                        else if (picked) colour_button = c_red;
                        highlight = picked;
                    }

                    terminal_draw_button(layout.buttons[b], labels[b], colour_button, highlight);
                }

                if (this.state === 'feedback')
                {
                    const right = (this.decision === 1 && correct_button === 0) || (this.decision === 0 && correct_button === 1);
                    let verdict = right ? 'CORRETO!' : 'INCORRETO!';
                    if (this.decision === -1) verdict = 'TEMPO ESGOTADO! O pacote passou sem inspeção.';

                    draw_set_colour(right ? c_lime : c_red);
                    draw_text(right_x1, layout.feedback_y, verdict);
                    draw_set_colour(c_aqua);
                    draw_text(right_x1, layout.feedback_y + line_height + 4,
                        'Regra ' + (this.matched_rule + 1) + ' decide: ' + (rules[this.matched_rule].allow ? 'PERMITIR' : 'BLOQUEAR'));
                    draw_set_colour(c_white);
                    draw_text_ext(right_x1, layout.feedback_y + line_height * 2 + 12, packet.note, line_height, right_width);

                    const last = (this.wave >= this.waves.length - 1 && this.packet_index >= this.waves[this.wave].packets.length - 1);
                    hint = last ? 'Enter, Espaço ou clique: ver resultado >' : 'Enter, Espaço ou clique: próximo pacote >';
                }
                else
                {
                    hint = 'A/D: escolher   Enter ou clique: decidir   1: Permitir   2: Bloquear   Esc: sair';
                }
            }
        }

        terminal_draw_hint(layout, hint, this.state !== 'packet', this.idle_timer);
    }
}

OBJECTS.obj_netfilter = Netfilter;
