'use strict';
// Sistema de falas: caixa de diálogo com retrato à esquerda (obj_dialogue)

/// Uma fala: quem fala, o que fala e o retrato mostrado à esquerda da caixa.
const dialogue_line = (speaker, text, portrait = 'spr_senatir_face_01') => ({ speaker, text, portrait });

/// Uma fala com escolhas: o jogador escolhe uma das opções de dialogue_option().
const dialogue_choice = (speaker, text, options, portrait = 'spr_senatir_face_01') => ({ speaker, text, portrait, choices: options });

/// Uma opção de escolha: as falas que ela abre. Se não encerrar (ends), a escolha volta
/// depois das falas, com a opção já usada em cinza. action (opcional) roda quando ela é escolhida.
const dialogue_option = (label, lines, ends = false, action = undefined) => ({ label, lines, ends, action, picked: false });

/// Verdadeiro enquanto a caixa de falas, um minijogo de computador ou uma tela de fim está aberta (o mapa fica congelado).
const dialogue_is_active = () => instance_exists('obj_dialogue') || quiz_is_active() || instance_exists('obj_end_screen');

/// Abre a caixa com uma lista de falas. Ignora se já houver uma fala na tela.
function dialogue_start(lines)
{
    if (dialogue_is_active()) return noone;
    if (!Array.isArray(lines)) lines = [lines];
    if (lines.length === 0) return noone;

    return instance_create(Dialogue, 0, 0, { lines: lines.slice() });
}

class Dialogue extends Instance
{
    static object = 'obj_dialogue';

    create()
    {
        this.lines ??= [];
        this.page = 0;
        this.chars_shown = 0;
        this.chars_per_step = 1.5;   // velocidade da máquina de escrever
        this.idle_timer = 0;         // pisca o aviso de "continuar"
        this.close_requested = false;

        // Ignora a tecla que abriu a fala (ou que fechou o combate), para não pular a primeira página
        this.input_delay = 2;

        this.depth = -20000;

        this.choice_index = 0;
        this.choice_line_height = 28;

        // Com escolhas o número de páginas muda no caminho, então o contador "1/5" não aparece
        this.has_any_choices = this.lines.some((line) => line.choices !== undefined);
    }

    current_line() { return this.lines[this.page]; }

    page_is_complete() { return this.chars_shown >= [...this.current_line().text].length; }

    // Fechar só no End Step: assim o jogador ainda vê a fala aberta neste frame
    // e a mesma tecla não reabre a placa na hora.
    close() { this.close_requested = true; }

    /// A página atual é uma escolha (dialogue_choice)?
    page_has_choices() { return this.current_line().choices !== undefined; }

    /// Caixa e topo da primeira opção (usado pelo Step para o mouse e pelo Draw GUI)
    get_box()
    {
        const margin = 24;
        const box_height = 200;
        const y1 = GUI_H - margin - box_height;
        return { x1: margin, y1, x2: GUI_W - margin, y2: GUI_H - margin, choices_top: y1 + 84 };
    }

    /// Escolhe uma opção: as falas dela entram logo depois desta página e, se não encerrar, a escolha volta
    pick_choice(index)
    {
        const choice_line = this.current_line();
        const option = choice_line.choices[index];
        option.picked = true;

        if (option.action !== undefined) option.action();

        let insert_at = this.page + 1;
        for (const line of option.lines)
        {
            this.lines.splice(insert_at, 0, line);
            insert_at += 1;
        }
        if (!option.ends) this.lines.splice(insert_at, 0, choice_line);

        this.page += 1;
        this.chars_shown = 0;
        this.idle_timer = 0;
        this.choice_index = 0;
        if (this.page >= this.lines.length) this.close();
    }

    step()
    {
        if (this.lines.length === 0 || this.page >= this.lines.length)
        {
            this.close();
            return;
        }

        const length = [...this.current_line().text].length;
        const complete = this.page_is_complete();

        if (complete) this.idle_timer += 1;
        else this.chars_shown = Math.min(this.chars_shown + this.chars_per_step, length);

        if (this.input_delay > 0)
        {
            this.input_delay -= 1;
            return;
        }

        // Escolhas: setas ou mouse escolhem, Enter/Espaço/E ou clique confirmam
        if (this.page_has_choices() && complete)
        {
            const count = this.current_line().choices.length;

            if (keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W'))) this.choice_index = (this.choice_index - 1 + count) % count;
            if (keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S'))) this.choice_index = (this.choice_index + 1) % count;

            const box = this.get_box();
            let clicked_option = -1;
            for (let i = 0; i < count; i++)
            {
                const top = box.choices_top + i * this.choice_line_height;
                if (point_in_rectangle(device_mouse_x_to_gui(), device_mouse_y_to_gui(), box.x1, top - 3, box.x2, top + this.choice_line_height - 4))
                {
                    this.choice_index = i;
                    if (mouse_check_button_pressed()) clicked_option = i;
                }
            }

            const confirm = keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space) || keyboard_check_pressed(ord('E'));
            if (clicked_option >= 0) this.pick_choice(clicked_option);
            else if (confirm) this.pick_choice(this.choice_index);

            // Esc fecha sem escolher (dá para voltar e conversar de novo)
            if (keyboard_check_pressed(vk_escape)) this.close();
            return;
        }

        const advance = keyboard_check_pressed(vk_enter)
            || keyboard_check_pressed(vk_space)
            || keyboard_check_pressed(ord('E'))
            || mouse_check_button_pressed();

        if (advance)
        {
            if (!complete)
            {
                // O primeiro toque mostra a fala inteira, o seguinte passa a página
                this.chars_shown = length;
            }
            else
            {
                this.page += 1;
                this.chars_shown = 0;
                this.idle_timer = 0;
                if (this.page >= this.lines.length) this.close();
            }
        }

        if (keyboard_check_pressed(vk_escape)) this.close();
    }

    end_step()
    {
        if (this.close_requested) instance_destroy(this);
    }

    draw() {}

    draw_gui()
    {
        if (this.lines.length === 0 || this.page >= this.lines.length) return;

        const line = this.current_line();

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        const padding = 12;
        const box = this.get_box();
        const { x1, y1, x2, y2 } = box;
        const box_height = y2 - y1;

        ui_draw_panel(x1, y1, x2, y2);

        // Retrato à esquerda
        const portrait = line.portrait;
        const portrait_x = x1 + padding;
        const portrait_y = y1 + padding;
        const portrait_height = box_height - padding * 2;
        const portrait_scale = portrait_height / sprite_get_height(portrait);
        const portrait_width = sprite_get_width(portrait) * portrait_scale;

        // O retrato é um desenho grande sendo reduzido: aqui a suavização ajuda.
        // Soma a origem do sprite para qualquer retrato encostar no canto de cima à esquerda.
        gpu_set_texfilter(true);
        draw_sprite_ext(portrait, 0, portrait_x + sprite_get_xoffset(portrait) * portrait_scale, portrait_y + sprite_get_yoffset(portrait) * portrait_scale,
            portrait_scale, portrait_scale, 0, c_white, 1);
        gpu_set_texfilter(false);

        draw_set_colour(UI_BORDER);
        draw_rectangle(portrait_x, portrait_y, portrait_x + portrait_width, portrait_y + portrait_height, true);
        draw_set_colour(c_white);

        // Nome e fala
        const line_height = 22;
        const text_x = portrait_x + portrait_width + 20;
        const text_y = y1 + padding + 2;
        const text_width = x2 - padding - 4 - text_x;

        draw_set_colour(c_aqua);
        draw_text(text_x, text_y, line.speaker);
        draw_set_colour(UI_BORDER);
        draw_line(text_x, text_y + line_height + 2, x2 - padding - 4, text_y + line_height + 2);
        draw_set_colour(c_white);

        draw_text_ext(text_x, text_y + line_height + 12, [...line.text].slice(0, Math.floor(this.chars_shown)).join(''), line_height, text_width);

        // Escolhas
        const has_choices = this.page_has_choices();
        if (has_choices && this.page_is_complete())
        {
            line.choices.forEach((option, i) =>
            {
                const option_y = box.choices_top + i * this.choice_line_height;
                const selected = (i === this.choice_index);

                if (selected)
                {
                    draw_set_alpha(0.35);
                    draw_set_colour(c_aqua);
                    draw_rectangle(text_x - 6, option_y - 3, x2 - padding - 4, option_y + this.choice_line_height - 6, false);
                    draw_set_alpha(1);
                }

                // Já perguntou: fica em cinza, mas dá para perguntar de novo
                draw_set_colour(option.picked ? c_gray : (selected ? c_yellow : c_white));
                draw_text(text_x, option_y, (selected ? '> ' : '  ') + option.label);
            });

            draw_set_halign(fa_right);
            draw_set_colour(c_gray);
            draw_text(x2 - padding - 4, y2 - padding - line_height, 'W/S ou setas: escolher   Enter ou clique: falar');
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }

        // Aviso de continuar
        if (this.page_is_complete() && !has_choices)
        {
            const last = (this.page >= this.lines.length - 1);
            const hint = last ? 'Enter, Espaço ou clique: fechar' : 'Enter, Espaço ou clique: continuar >';

            draw_set_halign(fa_right);
            draw_set_colour((Math.floor(this.idle_timer / 20) % 2 === 0) ? c_yellow : c_gray);
            draw_text(x2 - padding - 4, y2 - padding - line_height, hint);
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }

        if (this.lines.length > 1 && !this.has_any_choices)
        {
            draw_set_colour(c_gray);
            draw_text(text_x, y2 - padding - line_height, (this.page + 1) + '/' + this.lines.length);
            draw_set_colour(c_white);
        }
    }
}

OBJECTS.obj_dialogue = Dialogue;
