'use strict';
// Sistema de falas: caixa de diálogo com retrato à esquerda (obj_dialogue)

/// Uma fala: quem fala, o que fala e o retrato mostrado à esquerda da caixa.
const dialogue_line = (speaker, text, portrait = 'spr_senatir_face_01') => ({ speaker, text, portrait });

/// Verdadeiro enquanto a caixa de falas está aberta (o mapa fica congelado).
const dialogue_is_active = () => game.dialogue !== null;

/// Abre a caixa com uma lista de falas. Ignora se já houver uma fala na tela.
function dialogue_start(lines)
{
    if (dialogue_is_active()) return null;
    if (!Array.isArray(lines)) lines = [lines];
    if (lines.length === 0) return null;

    game.dialogue = new Dialogue(lines);
    return game.dialogue;
}

class Dialogue
{
    constructor(lines)
    {
        this.lines = lines;
        this.page = 0;
        this.chars_shown = 0;
        this.chars_per_step = 1.5;   // velocidade da máquina de escrever
        this.idle_timer = 0;         // pisca o aviso de "continuar"
        this.close_requested = false;
    }

    current_line() { return this.lines[this.page]; }

    page_is_complete() { return this.chars_shown >= [...this.current_line().text].length; }

    // Fechar só no End Step: assim o jogador ainda vê a fala aberta neste frame
    // e a mesma tecla não reabre a placa na hora.
    close() { this.close_requested = true; }

    step()
    {
        if (this.lines.length === 0)
        {
            this.close();
            return;
        }

        const length = [...this.current_line().text].length;
        const complete = this.page_is_complete();

        if (complete) this.idle_timer += 1;
        else this.chars_shown = Math.min(this.chars_shown + this.chars_per_step, length);

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
        if (this.close_requested) game.dialogue = null;
    }

    draw_gui()
    {
        if (this.lines.length === 0 || this.page >= this.lines.length) return;

        const line = this.current_line();

        draw_set_halign(fa_left);
        draw_set_valign(fa_top);

        const margin = 24;
        const padding = 12;
        const box_height = 200;
        const x1 = margin;
        const y1 = GUI_H - margin - box_height;
        const x2 = GUI_W - margin;
        const y2 = GUI_H - margin;

        ui_draw_panel(x1, y1, x2, y2);

        // Retrato à esquerda
        const portrait_x = x1 + padding;
        const portrait_y = y1 + padding;
        const portrait_height = box_height - padding * 2;
        const portrait_scale = portrait_height / sprite_get_height(line.portrait);
        const portrait_width = sprite_get_width(line.portrait) * portrait_scale;

        // O retrato é um desenho grande sendo reduzido: aqui a suavização ajuda
        gpu_set_texfilter(true);
        draw_sprite_ext(line.portrait, 0, portrait_x, portrait_y, portrait_scale, portrait_scale, 0, c_white, 1);
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

        // Aviso de continuar
        if (this.page_is_complete())
        {
            const last = (this.page >= this.lines.length - 1);
            const hint = last ? 'Enter, Espaço ou clique: fechar' : 'Enter, Espaço ou clique: continuar >';

            draw_set_halign(fa_right);
            draw_set_colour((Math.floor(this.idle_timer / 20) % 2 === 0) ? c_yellow : c_gray);
            draw_text(x2 - padding - 4, y2 - padding - line_height, hint);
            draw_set_halign(fa_left);
            draw_set_colour(c_white);
        }

        if (this.lines.length > 1)
        {
            draw_set_colour(c_gray);
            draw_text(text_x, y2 - padding - line_height, (this.page + 1) + '/' + this.lines.length);
            draw_set_colour(c_white);
        }
    }
}
