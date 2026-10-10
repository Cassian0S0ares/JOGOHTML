'use strict';
/// Terminais dos computadores: cada computador abre um minijogo de cibersegurança.
/// Room1: quiz (obj_quiz). Room2: caixa de entrada (obj_inbox), atualizações (obj_patch) e regras de firewall (obj_netfilter).
/// Todos os minijogos são filhos de obj_terminal, então o mapa congela enquanto qualquer um estiver aberto.

/// Verdadeiro enquanto algum minijogo de computador está aberto.
function terminal_is_active()
{
    return instance_exists('obj_terminal');
}

/// Qual minijogo o computador naquele ponto abre.
/// Room2: sala do topo à esquerda (acima de onde o antivírus nasce) "inbox", topo direita "patch", direita baixo "netfilter".
function terminal_kind_at(x, y)
{
    if (game.room === 'Room2')
    {
        if (x < game.room_width / 2) return "inbox";
        return (y < game.room_height / 2) ? "patch" : "netfilter";
    }
    return "quiz";
}

function terminal_get_title(kind, topic)
{
    switch (kind)
    {
        case "inbox": return "Caixa de Entrada";
        case "patch": return "Central de Atualizações";
        case "netfilter": return "Regras do Firewall";
    }
    return quiz_get_title(topic);
}

/// Abre o minijogo do computador. Ignora se já houver uma fala ou um terminal na tela.
function terminal_start(computer)
{
    if (dialogue_is_active()) return noone;

    let object;
    switch (computer.terminal_kind)
    {
        case "inbox": object = Inbox; break;
        case "patch": object = Patch; break;
        case "netfilter": object = Netfilter; break;
        default: return quiz_start(computer);
    }

    return instance_create(object, 0, 0, { computer, title: computer.quiz_title });
}

/// Marca o computador como protegido (tela verde).
function terminal_solve(computer)
{
    if (!instance_exists(computer)) return;
    computer.solved = true;
    computer_remember_solved(computer);
}

/// Painel centralizado na GUI: { x1, y1, x2, y2, padding, line_height, text_x, text_width, body_y }.
function terminal_layout(max_width = 1040, max_height = 640)
{
    const width = Math.min(max_width, GUI_W - 48);
    const height = Math.min(max_height, GUI_H - 48);
    const x1 = Math.floor((GUI_W - width) / 2);
    const y1 = Math.floor((GUI_H - height) / 2);
    const padding = 20;

    return {
        x1, y1, x2: x1 + width, y2: y1 + height,
        padding, line_height: 22,
        text_x: x1 + padding, text_width: width - padding * 2,
        body_y: y1 + padding + 40
    };
}

/// Fundo escurecido, painel e cabeçalho "> TERMINAL DE SEGURANÇA" iguais aos do quiz.
function terminal_draw_frame(layout, title, progress)
{
    draw_set_alpha(0.6);
    draw_set_colour(c_black);
    draw_rectangle(0, 0, GUI_W, GUI_H, false);
    draw_set_alpha(1);

    ui_draw_panel(layout.x1, layout.y1, layout.x2, layout.y2);

    draw_set_halign(fa_left);
    draw_set_valign(fa_top);

    draw_set_colour(c_aqua);
    draw_text(layout.text_x, layout.y1 + layout.padding, "> TERMINAL DE SEGURANÇA :: " + title);

    draw_set_halign(fa_right);
    draw_set_colour(c_gray);
    draw_text(layout.x2 - layout.padding, layout.y1 + layout.padding, progress);
    draw_set_halign(fa_left);

    const line_y = layout.y1 + layout.padding + layout.line_height + 6;
    draw_set_colour(UI_BORDER);
    draw_line(layout.text_x, line_y, layout.x2 - layout.padding, line_y);
    draw_set_colour(c_white);
}

/// Aviso de controles no canto de baixo; pisca quando é para continuar.
function terminal_draw_hint(layout, hint, blink, timer)
{
    draw_set_halign(fa_right);
    if (blink) draw_set_colour((Math.floor(timer / 20) % 2 === 0) ? c_yellow : c_gray);
    else draw_set_colour(c_gray);
    draw_text(layout.x2 - layout.padding, layout.y2 - layout.padding - layout.line_height, hint);
    draw_set_halign(fa_left);
    draw_set_colour(c_white);
}

/// Botão retangular com texto centralizado. rect: { x1, y1, x2, y2 }.
function terminal_draw_button(rect, label, colour, highlight)
{
    draw_set_colour(highlight ? merge_colour(make_colour_rgb(32, 30, 46), colour, 0.35) : make_colour_rgb(32, 30, 46));
    draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, false);
    draw_set_colour(highlight ? c_white : colour);
    draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, true);
    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);
    draw_set_colour(highlight ? c_white : colour);
    draw_text((rect.x1 + rect.x2) / 2, (rect.y1 + rect.y2) / 2, label);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
    draw_set_colour(c_white);
}

/// Tela final: placar grande e uma mensagem.
function terminal_draw_result(layout, title_text, good, message)
{
    const center_x = (layout.x1 + layout.x2) / 2;
    const y = layout.body_y + 60;

    draw_set_halign(fa_center);
    ui_draw_text_shadow(center_x, y, title_text, good ? c_lime : c_yellow, 2);
    draw_set_colour(c_white);
    draw_text_ext(center_x, y + 80, message, layout.line_height, layout.text_width - 80);
    draw_set_halign(fa_left);
}

function terminal_mouse_in(rect)
{
    return point_in_rectangle(device_mouse_x_to_gui(), device_mouse_y_to_gui(), rect.x1, rect.y1, rect.x2, rect.y2);
}
