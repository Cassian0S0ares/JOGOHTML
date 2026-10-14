'use strict';
// Caixa de entrada (obj_inbox, Room2): phishing ou legítimo? Marca as partes suspeitas e decide Confiar ou Quarentena.

class Inbox extends Terminal
{
    static object = 'obj_inbox';

    create()
    {
        super.create();

        // "computer" e "title" vêm de terminal_start()
        this.title ??= 'Caixa de Entrada';

        this.emails = inbox_get_emails();

        // Estados: "inspect" marcando e decidindo, "feedback" mostrando as pistas, "result" placar final
        this.state = 'inspect';
        this.index = 0;              // e-mail atual
        this.selected = 0;           // item destacado: os campos do e-mail e depois os botões Confiar e Quarentena
        this.marks = [false, false, false, false, false];
        this.decision = -1;          // 0 confiar, 1 quarentena
        this.correct_count = 0;
        this.clues_found = 0;
        this.clues_total = 0;
    }

    current_email() { return this.emails[this.index]; }

    /// Retângulos em coordenadas da GUI; usado pelo Step (mouse) e pelo Draw GUI
    layout()
    {
        const result = terminal_layout(1000, 660);
        result.fields = [];
        result.buttons = [];
        if (this.state === 'result') return result;

        const email = this.current_email();
        const label_width = 110;
        const value_x = result.text_x + label_width;
        const value_width = result.x2 - result.padding - value_x - 150;   // espaço à direita para a etiqueta (PISTA, SUSPEITO)
        let y = result.body_y + 34;

        for (const field of inbox_email_fields(email))
        {
            const height = string_height_ext(email.values[field], result.line_height, value_width) + 12;
            result.fields.push({
                field,
                x1: result.text_x, y1: y, x2: result.x2 - result.padding, y2: y + height,
                value_x: value_x + 6, value_width,
            });
            y += height + 6;
        }

        y += 10;
        const center_x = (result.x1 + result.x2) / 2;
        result.buttons.push({ x1: center_x - 250, y1: y, x2: center_x - 20, y2: y + 38 });
        result.buttons.push({ x1: center_x + 20, y1: y, x2: center_x + 250, y2: y + 38 });
        result.feedback_y = y + 54;

        return result;
    }

    toggle_mark(field) { this.marks[field] = !this.marks[field]; }

    decide(quarantine)
    {
        const email = this.current_email();
        this.decision = quarantine ? 1 : 0;
        if (quarantine === email.phishing) this.correct_count += 1;

        for (const clue of email.clues)
        {
            this.clues_total += 1;
            if (this.marks[clue]) this.clues_found += 1;
        }

        this.state = 'feedback';
        this.idle_timer = 0;
    }

    next_email()
    {
        this.index += 1;
        this.selected = 0;
        this.decision = -1;
        this.marks = [false, false, false, false, false];
        this.idle_timer = 0;

        if (this.index < this.emails.length)
        {
            this.state = 'inspect';
            return;
        }

        this.state = 'result';
        if (this.correct_count >= this.emails.length) terminal_solve(this.computer);
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
            case 'inspect':
            {
                const layout = this.layout();
                const field_count = layout.fields.length;
                const count = field_count + 2;

                const move = (keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S')))
                    - (keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W')));
                if (move !== 0) this.selected = (this.selected + move + count) % count;

                // Atalhos: 1 confia, 2 manda para a quarentena
                if (keyboard_check_pressed(ord('1')))
                {
                    this.decide(false);
                    return;
                }
                if (keyboard_check_pressed(ord('2')))
                {
                    this.decide(true);
                    return;
                }

                // Mouse: passar por cima destaca
                let hovered = -1;
                layout.fields.forEach((rect, i) => { if (terminal_mouse_in(rect)) hovered = i; });
                layout.buttons.forEach((rect, i) => { if (terminal_mouse_in(rect)) hovered = field_count + i; });
                if (this.mouse_moved() && hovered !== -1) this.selected = hovered;

                let target = -1;
                if (click && hovered !== -1) target = hovered;
                else if (confirm) target = this.selected;

                if (target !== -1)
                {
                    if (target < field_count) this.toggle_mark(layout.fields[target].field);
                    else this.decide(target === field_count + 1);
                }
                break;
            }

            case 'feedback':
                if (confirm || click) this.next_email();
                break;

            case 'result':
                if (confirm || click) this.close();
                break;
        }
    }

    /// E-mail, pistas marcadas, decisão e placar
    draw_gui()
    {
        const layout = this.layout();
        const total = this.emails.length;
        terminal_draw_frame(layout, this.title, (this.state === 'result') ? 'Fim' : 'E-mail ' + (this.index + 1) + '/' + total);

        const line_height = layout.line_height;
        const text_x = layout.text_x;
        let hint;

        if (this.state === 'result')
        {
            const perfect = (this.correct_count >= total);
            let message;
            if (perfect) message = 'Caixa de entrada protegida! Nenhum golpe passou e nenhum e-mail bom foi pra quarentena.';
            else message = 'Alguns e-mails foram parar no lugar errado. Leia as pistas com calma e tente de novo.';
            message += '\n\nPistas encontradas: ' + this.clues_found + '/' + this.clues_total;

            terminal_draw_result(layout, this.correct_count + '/' + total + ' decisões certas', perfect, message);
            hint = 'Enter, Espaço ou clique: fechar';
        }
        else
        {
            const email = this.current_email();
            const feedback = (this.state === 'feedback');

            draw_set_colour(c_gray);
            draw_text(text_x, layout.body_y, feedback ? 'Pistas do e-mail:' : 'Clique nas partes suspeitas para marcar (opcional). Depois decida: Confiar ou Quarentena.');

            // Campos do e-mail
            const field_count = layout.fields.length;
            layout.fields.forEach((rect, i) =>
            {
                const field = rect.field;
                const marked = this.marks[field];
                const is_clue = email.clues.includes(field);

                let fill = make_colour_rgb(32, 30, 46);
                let outline = UI_BORDER;
                let colour = c_white;
                let tag = '';
                let tag_colour = c_gray;

                if (!feedback)
                {
                    if (marked)
                    {
                        fill = make_colour_rgb(72, 30, 36);
                        outline = c_red;
                        tag = 'SUSPEITO';
                        tag_colour = c_red;
                    }
                    if (i === this.selected) outline = c_yellow;
                }
                else if (is_clue)
                {
                    fill = marked ? make_colour_rgb(24, 72, 40) : make_colour_rgb(80, 52, 20);
                    outline = marked ? c_lime : c_orange;
                    tag = marked ? 'PISTA ACHADA' : 'PISTA';
                    tag_colour = outline;
                }
                else if (marked)
                {
                    colour = c_gray;
                    tag = 'não era pista';
                }
                else
                {
                    colour = c_ltgray;
                }

                draw_set_colour(fill);
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, false);
                draw_set_colour(outline);
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, true);

                draw_set_colour(c_aqua);
                draw_text(rect.x1 + 10, rect.y1 + 6, inbox_field_label(field) + ':');
                draw_set_colour(colour);
                draw_text_ext(rect.value_x, rect.y1 + 6, email.values[field], line_height, rect.value_width);

                if (tag !== '')
                {
                    draw_set_halign(fa_right);
                    draw_set_colour(tag_colour);
                    draw_text(rect.x2 - 8, rect.y2 - line_height - 2, tag);
                    draw_set_halign(fa_left);
                }
            });

            // Botões
            const correct_button = email.phishing ? 1 : 0;
            for (let b = 0; b < 2; b++)
            {
                const label = (b === 0) ? '1) Confiar' : '2) Quarentena';
                let colour_button = (b === 0) ? c_lime : c_orange;
                let highlight;

                if (!feedback)
                {
                    highlight = (this.selected === field_count + b);
                }
                else
                {
                    colour_button = c_gray;
                    if (b === correct_button) colour_button = c_lime;
                    else if (b === this.decision) colour_button = c_red;
                    highlight = (b === this.decision);
                }

                terminal_draw_button(layout.buttons[b], label, colour_button, highlight);
            }

            if (feedback)
            {
                const right = (this.decision === correct_button);
                draw_set_colour(right ? c_lime : c_red);
                draw_text(text_x, layout.feedback_y, right ? 'CORRETO!' : 'INCORRETO!');
                draw_set_colour(c_white);
                draw_text_ext(text_x, layout.feedback_y + line_height + 4, email.explanation, line_height, layout.text_width);

                const last = (this.index >= total - 1);
                hint = last ? 'Enter, Espaço ou clique: ver resultado >' : 'Enter, Espaço ou clique: próximo e-mail >';
            }
            else
            {
                hint = 'W/S: escolher   Enter ou clique: marcar/decidir   1: Confiar   2: Quarentena   Esc: sair';
            }
        }

        terminal_draw_hint(layout, hint, this.state !== 'inspect', this.idle_timer);
    }
}

OBJECTS.obj_inbox = Inbox;
