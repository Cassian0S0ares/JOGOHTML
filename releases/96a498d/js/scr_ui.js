'use strict';
// Utilitários de interface (painéis, texto com sombra e barras)

const UI_BORDER = make_colour_rgb(96, 86, 128);

function ui_draw_panel(x1, y1, x2, y2)
{
    draw_set_alpha(0.9);
    draw_set_colour(make_colour_rgb(22, 20, 32));
    draw_rectangle(x1, y1, x2, y2, false);
    draw_set_alpha(1);
    draw_set_colour(UI_BORDER);
    draw_rectangle(x1, y1, x2, y2, true);
    draw_set_colour(c_white);
}

/// Texto com sombra, para ler bem por cima do fundo. Usa o alinhamento atual.
function ui_draw_text_shadow(x, y, text, colour, scale = 1)
{
    const alpha = draw_get_alpha();
    const offset = Math.max(1, Math.round(scale));

    draw_set_colour(c_black);
    draw_set_alpha(alpha * 0.8);
    draw_text_transformed(x + offset, y + offset, text, scale, scale, 0);
    draw_set_alpha(alpha);
    draw_set_colour(colour);
    draw_text_transformed(x, y, text, scale, scale, 0);
    draw_set_colour(c_white);
}

function ui_draw_bar(x, y, width, height, value, max_value, colour)
{
    const fill = (max_value > 0) ? clamp(value / max_value, 0, 1) : 0;

    draw_set_colour(make_colour_rgb(50, 20, 24));
    draw_rectangle(x, y, x + width, y + height, false);
    draw_set_colour(colour);
    if (fill > 0) draw_rectangle(x, y, x + width * fill, y + height, false);
    draw_set_colour(c_black);
    draw_rectangle(x, y, x + width, y + height, true);
    draw_set_colour(c_white);
}
