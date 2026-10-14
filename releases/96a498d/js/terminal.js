'use strict';
// Minijogos dos computadores: todos são filhos de obj_terminal, então o mapa congela enquanto qualquer um estiver aberto.
// Este arquivo tem a base (obj_terminal) e o quiz da Room1 (obj_quiz).

class Terminal extends Instance
{
    static object = 'obj_terminal';

    create()
    {
        this.computer ??= noone;
        this.idle_timer = 0;
        this.close_requested = false;

        // Ignora a tecla que abriu o terminal
        this.input_delay = 2;

        // O mouse só muda o destaque quando se mexe, para não brigar com o teclado
        this.last_mouse_x = device_mouse_x_to_gui();
        this.last_mouse_y = device_mouse_y_to_gui();

        this.depth = -20000;
    }

    close() { this.close_requested = true; }

    /// Verdadeiro se o mouse se mexeu desde a última chamada
    mouse_moved()
    {
        const moved = (device_mouse_x_to_gui() !== this.last_mouse_x || device_mouse_y_to_gui() !== this.last_mouse_y);
        this.last_mouse_x = device_mouse_x_to_gui();
        this.last_mouse_y = device_mouse_y_to_gui();
        return moved;
    }

    /// Fechamento adiado
    end_step()
    {
        if (this.close_requested) instance_destroy(this);
    }

    draw() {}
}

// ---------------------------------------------------------------- Quiz de cibersegurança (obj_quiz)

class Quiz extends Terminal
{
    static object = 'obj_quiz';

    create()
    {
        super.create();

        // "computer", "title" e "questions" vêm de quiz_start()
        this.questions ??= [];
        this.title ??= 'Cibersegurança';

        // Estados: "question" escolhendo, "feedback" mostrando a explicação, "result" placar final
        this.state = 'question';
        this.index = 0;          // pergunta atual
        this.selected = 0;       // alternativa destacada
        this.chosen = -1;        // alternativa confirmada
        this.correct_count = 0;
        this.awaken_boss = false;
    }

    current_question() { return this.questions[this.index]; }

    /// Retângulos da tela em coordenadas da GUI; usado pelo Step (mouse) e pelo Draw GUI
    layout()
    {
        const width = Math.min(920, GUI_W - 48);
        const height = Math.min(600, GUI_H - 48);
        const x1 = Math.floor((GUI_W - width) / 2);
        const y1 = Math.floor((GUI_H - height) / 2);
        const padding = 20;
        const text_width = width - padding * 2;

        const result = {
            x1, y1, x2: x1 + width, y2: y1 + height,
            padding, text_width,
            line_height: 22,
            question_y: y1 + padding + 56,
            options: [],
        };

        if (this.state === 'result' || this.questions.length === 0) return result;

        const question = this.current_question();
        let option_y = result.question_y + string_height_ext(question.text, result.line_height, text_width) + 20;
        question.options.forEach((option, i) =>
        {
            const label = String.fromCharCode(65 + i) + ') ' + option;
            const option_height = string_height_ext(label, result.line_height, text_width - 24) + 12;
            result.options.push({ x1: x1 + padding, y1: option_y, x2: x1 + width - padding, y2: option_y + option_height, label });
            option_y += option_height + 8;
        });
        result.feedback_y = option_y + 6;

        return result;
    }

    confirm_option(option)
    {
        this.chosen = option;
        if (this.chosen === this.current_question().answer) this.correct_count += 1;
        this.state = 'feedback';
        this.idle_timer = 0;
    }

    next_question()
    {
        this.index += 1;
        this.selected = 0;
        this.chosen = -1;
        this.idle_timer = 0;

        if (this.index < this.questions.length)
        {
            this.state = 'question';
            return;
        }

        // Fim: guarda o melhor placar no computador
        this.state = 'result';
        if (instance_exists(this.computer))
        {
            this.computer.best_score = Math.max(this.computer.best_score, this.correct_count);
            if (this.correct_count >= this.questions.length) this.computer.solved = true;
        }

        // Último computador protegido: o chefe desperta quando o quiz fechar
        this.awaken_boss = boss_ddos_should_awaken();
    }

    step()
    {
        if (this.questions.length === 0)
        {
            this.close();
            return;
        }

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
            case 'question':
            {
                const count = this.current_question().options.length;

                const move = (keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S')))
                    - (keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W')));
                if (move !== 0) this.selected = (this.selected + move + count) % count;

                // Teclas 1-4 respondem direto
                for (let i = 0; i < count; i++)
                {
                    if (keyboard_check_pressed(ord(String(i + 1))))
                    {
                        this.confirm_option(i);
                        return;
                    }
                }

                // Mouse: passar por cima destaca, clicar responde
                const options = this.layout().options;
                let hovered = -1;
                options.forEach((rect, i) =>
                {
                    if (terminal_mouse_in(rect)) hovered = i;
                });
                if (this.mouse_moved() && hovered !== -1) this.selected = hovered;

                if (click && hovered !== -1) this.confirm_option(hovered);
                else if (confirm) this.confirm_option(this.selected);
                break;
            }

            case 'feedback':
                if (confirm || click) this.next_question();
                break;

            case 'result':
                if (confirm || click) this.close();
                break;
        }
    }

    end_step()
    {
        if (this.close_requested)
        {
            if (this.awaken_boss) boss_ddos_awaken();
            instance_destroy(this);
        }
    }

    /// Tela do computador: pergunta, alternativas, explicação e placar
    draw_gui()
    {
        if (this.questions.length === 0) return;

        // Escurece o mapa atrás
        draw_set_alpha(0.6);
        draw_set_colour(c_black);
        draw_rectangle(0, 0, GUI_W, GUI_H, false);
        draw_set_alpha(1);

        const layout = this.layout();
        const { x1, y1, x2, y2, padding, line_height } = layout;
        const text_x = x1 + padding;

        ui_draw_panel(x1, y1, x2, y2);

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        // Cabeçalho
        draw_set_colour(c_aqua);
        draw_text(text_x, y1 + padding, '> TERMINAL DE SEGURANÇA :: ' + this.title);

        draw_set_halign(fa_right);
        draw_set_colour(c_gray);
        draw_text(x2 - padding, y1 + padding, (this.state === 'result') ? 'Fim' : 'Pergunta ' + (this.index + 1) + '/' + this.questions.length);
        draw_set_halign(fa_left);

        draw_set_colour(UI_BORDER);
        draw_line(text_x, y1 + padding + line_height + 6, x2 - padding, y1 + padding + line_height + 6);

        let hint;

        if (this.state === 'result')
        {
            // Placar final
            const total = this.questions.length;
            const perfect = (this.correct_count >= total);
            const center_x = (x1 + x2) / 2;
            const y = layout.question_y + 40;

            draw_set_halign(fa_center);
            ui_draw_text_shadow(center_x, y, this.correct_count + '/' + total + ' acertos', perfect ? c_lime : c_yellow, 2);

            let message;
            if (perfect) message = 'Sistema protegido! Você mandou muito bem.';
            else if (this.correct_count >= total - 2) message = 'Quase lá! Revise as explicações e tente de novo para proteger este computador.';
            else message = 'O sistema continua vulnerável. Tente de novo e leia com calma as explicações.';

            draw_set_colour(c_white);
            draw_text_ext(center_x, y + 80, message, line_height, layout.text_width);
            draw_set_halign(fa_left);

            hint = 'Enter, Espaço ou clique: fechar';
        }
        else
        {
            const question = this.current_question();

            draw_set_colour(c_white);
            draw_text_ext(text_x, layout.question_y, question.text, line_height, layout.text_width);

            // Alternativas
            layout.options.forEach((rect, i) =>
            {
                let fill = make_colour_rgb(32, 30, 46);
                let outline = UI_BORDER;
                let colour = c_white;

                if (this.state === 'question' && i === this.selected)
                {
                    fill = make_colour_rgb(48, 44, 80);
                    outline = c_yellow;
                    colour = c_yellow;
                }
                else if (this.state === 'feedback')
                {
                    if (i === question.answer)
                    {
                        fill = make_colour_rgb(24, 72, 40);
                        outline = c_lime;
                        colour = c_lime;
                    }
                    else if (i === this.chosen)
                    {
                        fill = make_colour_rgb(80, 24, 30);
                        outline = c_red;
                        colour = make_colour_rgb(255, 140, 140);
                    }
                    else
                    {
                        colour = c_gray;
                    }
                }

                draw_set_colour(fill);
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, false);
                draw_set_colour(outline);
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, true);
                draw_set_colour(colour);
                draw_text_ext(rect.x1 + 12, rect.y1 + 6, rect.label, line_height, rect.x2 - rect.x1 - 24);
            });

            if (this.state === 'feedback')
            {
                // Explicação
                const right = (this.chosen === question.answer);
                draw_set_colour(right ? c_lime : c_red);
                draw_text(text_x, layout.feedback_y, right ? 'CORRETO!' : 'INCORRETO!');
                draw_set_colour(c_white);
                draw_text_ext(text_x, layout.feedback_y + line_height + 4, question.explanation, line_height, layout.text_width);

                const last = (this.index >= this.questions.length - 1);
                hint = last ? 'Enter, Espaço ou clique: ver resultado >' : 'Enter, Espaço ou clique: próxima >';
            }
            else
            {
                hint = 'W/S ou setas: escolher   1-4, Enter ou clique: responder   Esc: sair';
            }
        }

        // Aviso de controles: pisca só quando é para continuar
        draw_set_halign(fa_right);
        if (this.state === 'question') draw_set_colour(c_gray);
        else draw_set_colour((Math.floor(this.idle_timer / 20) % 2 === 0) ? c_yellow : c_gray);
        draw_text(x2 - padding, y2 - padding - line_height, hint);
        draw_set_halign(fa_left);
        draw_set_colour(c_white);
    }
}

Object.assign(OBJECTS, { obj_terminal: Terminal, obj_quiz: Quiz });
