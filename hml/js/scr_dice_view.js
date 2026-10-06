'use strict';
// Rolagem de dados animada na tela (estilo Baldur's Gate 3)
// Um "evento de dados" é um objeto criado por dice_event_create e desenhado por dice_draw_event.

const DICE_COLOUR_HERO = make_colour_rgb(236, 226, 198);
const DICE_COLOUR_FOE = make_colour_rgb(142, 84, 192);
const DICE_COLOUR_SLASHING = make_colour_rgb(196, 58, 58);
const DICE_COLOUR_BLUDGEONING = make_colour_rgb(206, 196, 176);
const DICE_COLOUR_ACID = make_colour_rgb(96, 176, 70);
const DICE_TEXT_DARK = make_colour_rgb(26, 24, 36);

function dice_event_create(title, accent)
{
    return {
        type: 'dice',
        title,
        accent,
        target_text: '',
        mode_text: '',
        dice: [],
        dice_label: '',
        modifiers: [],
        total: 0,
        total_label: 'Total',
        verdict: '',
        verdict_colour: c_white,
        fast: false,
    };
}

/// Adiciona o(s) d20 de roll_d20; com vantagem/desvantagem aparecem os dois e o descartado apaga.
function dice_event_add_d20(event, d20, colour, text_colour)
{
    d20.rolls.forEach((value, i) =>
    {
        event.dice.push({ sides: 20, value, kept: i === d20.kept_index, colour, text_colour });
    });
    event.dice_label = 'd20';
}

/// Adiciona os dados de roll_dice (todos contam na soma).
function dice_event_add_roll(event, roll, colour, text_colour)
{
    for (const value of roll.rolls) event.dice.push({ sides: roll.sides, value, kept: true, colour, text_colour });

    const label = roll.rolls.length + 'd' + roll.sides;
    event.dice_label = (event.dice_label === '') ? label : event.dice_label + '+' + label;
}

function dice_event_add_modifier(event, value, label)
{
    event.modifiers.push({ value, label });
}

/// Calcula a linha do tempo da animação (em frames). Chamado quando o evento começa.
function dice_event_prepare(event)
{
    event.timer = 0;
    event.appear = 8;
    event.spin_end = event.appear + (event.fast ? 26 : 42);

    const kept = event.dice.filter((d) => d.kept).length;
    const modifier_count = event.modifiers.length;
    const has_discarded = (kept !== event.dice.length);

    // Só mostra "= total" quando há mais de uma parcela para somar
    event.show_sum = (kept + modifier_count) > 1;
    event.chips_start = event.spin_end + (has_discarded ? 18 : 10);
    event.total_at = event.show_sum ? event.chips_start + (modifier_count + 1) * 9 : event.chips_start;
    event.verdict_at = event.total_at + (event.show_sum ? 10 : 0);
    event.duration = event.verdict_at + ((event.verdict !== '') ? 12 : 0) + (event.fast ? 36 : 56);
}

/// Primeiro pulo vai direto ao resultado; o segundo encerra.
function dice_event_skip(event)
{
    if (event.timer < event.verdict_at) event.timer = event.verdict_at;
    else event.timer = event.duration;
}

/// Desenha um dado facetado: polígono externo sombreado + face interna + arestas.
function dice_draw_die(sides, x, y, radius, angle, squash, colour, alpha)
{
    let outer_count = 6, outer_start = 90, inner_count = 3, inner_start = 90, inner_scale = 0.56;

    switch (sides)
    {
        case 4:  outer_count = 3; outer_start = 90; inner_count = 3; inner_start = 270; inner_scale = 0.42; break;
        case 6:  outer_count = 4; outer_start = 45; inner_count = 4; inner_start = 45;  inner_scale = 0.62; break;
        case 8:  outer_count = 4; outer_start = 90; inner_count = 3; inner_start = 90;  inner_scale = 0.5;  break;
        case 10: outer_count = 5; outer_start = 90; inner_count = 3; inner_start = 270; inner_scale = 0.45; break;
        case 12: outer_count = 5; outer_start = 90; inner_count = 5; inner_start = 90;  inner_scale = 0.58; break;
    }

    const outer = [];
    for (let i = 0; i < outer_count; i++)
    {
        const a = outer_start + i * 360 / outer_count + angle;
        outer.push([x + lengthdir_x(radius, a) * squash, y + lengthdir_y(radius, a), outer_start + i * 360 / outer_count]);
    }

    const inner = [];
    for (let i = 0; i < inner_count; i++)
    {
        const a = inner_start + i * 360 / inner_count + angle;
        inner.push([x + lengthdir_x(radius * inner_scale, a) * squash, y + lengthdir_y(radius * inner_scale, a), inner_start + i * 360 / inner_count]);
    }

    // Base sólida por baixo das facetas (evita frestas entre os triângulos)
    draw_polygon(outer, merge_colour(colour, c_black, 0.15), alpha);

    // Facetas externas: luz vindo do canto superior esquerdo
    for (let i = 0; i < outer_count; i++)
    {
        const p1 = outer[i];
        const p2 = outer[(i + 1) % outer_count];
        const mid_x = (p1[0] + p2[0]) / 2 - x;
        const mid_y = (p1[1] + p2[1]) / 2 - y;
        const length = Math.max(0.001, Math.hypot(mid_x, mid_y));
        const light = 0.85 + 0.3 * ((mid_x / length) * -0.6 + (mid_y / length) * -0.8);
        const facet_colour = (light > 1) ? merge_colour(colour, c_white, light - 1) : merge_colour(colour, c_black, 1 - light);
        draw_polygon([[x, y], p1, p2], facet_colour, alpha);
    }

    // Face da frente
    draw_polygon(inner, merge_colour(colour, c_white, 0.12), alpha);

    // Arestas: cada vértice externo liga ao vértice interno mais próximo
    draw_set_alpha(alpha);
    draw_set_colour(merge_colour(colour, c_black, 0.4));
    for (let i = 0; i < outer_count; i++)
    {
        let best = 0;
        for (let j = 1; j < inner_count; j++)
        {
            if (Math.abs(angle_difference(outer[i][2], inner[j][2])) < Math.abs(angle_difference(outer[i][2], inner[best][2]))) best = j;
        }
        draw_line_width(outer[i][0], outer[i][1], inner[best][0], inner[best][1], 2);
    }
    for (let i = 0; i < inner_count; i++)
    {
        const p1 = inner[i];
        const p2 = inner[(i + 1) % inner_count];
        draw_line_width(p1[0], p1[1], p2[0], p2[1], 2);
    }

    draw_set_colour(merge_colour(colour, c_black, 0.7));
    for (let i = 0; i < outer_count; i++)
    {
        const p1 = outer[i];
        const p2 = outer[(i + 1) % outer_count];
        draw_line_width(p1[0], p1[1], p2[0], p2[1], 3);
    }

    draw_set_colour(c_white);
}

/// Desenha a rolagem dentro do retângulo (a arena): título, alvo, dados, parcelas, total e resultado.
function dice_draw_event(event, x1, y1, x2, y2)
{
    const t = event.timer;
    const fade = clamp(Math.min(t / event.appear, (event.duration - t) / 10), 0, 1);
    const cx = (x1 + x2) / 2;
    const height = y2 - y1;

    // Escurece a arena por trás dos dados
    draw_set_alpha(0.62 * fade);
    draw_set_colour(c_black);
    draw_rectangle(x1, y1, x2, y2, false);
    draw_set_alpha(fade);

    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);

    // Título, alvo e vantagem
    const title_y = y1 + height * 0.1;
    ui_draw_text_shadow(cx, title_y, event.title, event.accent);

    if (event.target_text !== '') ui_draw_text_shadow(cx, title_y + 32, event.target_text, c_white, 2);

    if (event.mode_text !== '')
    {
        let mode_colour = c_ltgray;
        if (event.mode_text.startsWith('VANTAGEM')) mode_colour = c_lime;
        if (event.mode_text.startsWith('DESVANTAGEM')) mode_colour = make_colour_rgb(255, 110, 110);
        ui_draw_text_shadow(cx, title_y + 62, event.mode_text, mode_colour);
    }

    // Dados
    const count = event.dice.length;
    const radius = (count <= 2) ? 44 : ((count <= 4) ? 34 : 26);
    const spacing = radius * 2.5;
    const dice_y = y1 + height * 0.47;
    const spin_t = clamp((t - event.appear) / (event.spin_end - event.appear), 0, 1);
    const ease = 1 - Math.pow(1 - spin_t, 3);
    const landed = (t >= event.spin_end);
    let has_discarded = false;
    let dice_sum = 0;

    for (const die of event.dice)
    {
        if (die.kept) dice_sum += die.value;
        else has_discarded = true;
    }

    for (let i = 0; i < count; i++)
    {
        const die = event.dice[i];
        const dx = cx + (i - (count - 1) / 2) * spacing;
        const dy = dice_y - Math.abs(Math.sin(ease * Math.PI * 3 + i)) * 18 * (1 - ease);
        const angle = (1 - ease) * (720 + i * 90);
        const squash = lerp(1, 0.45 + 0.55 * Math.abs(Math.cos(ease * Math.PI * 5 + i)), 1 - ease);
        const pop = landed ? 1 + Math.sin(clamp((t - event.spin_end) / 10, 0, 1) * Math.PI) * 0.18 : 1;
        let die_alpha = fade;
        let die_colour = die.colour;

        // O dado descartado (vantagem/desvantagem) apaga depois de pousar
        if (!die.kept && t >= event.spin_end + 8)
        {
            const discard = clamp((t - event.spin_end - 8) / 10, 0, 1);
            die_alpha *= lerp(1, 0.35, discard);
            die_colour = merge_colour(die_colour, c_gray, discard * 0.7);
        }

        const is_critical = landed && die.kept && die.sides === 20 && die.value === 20;
        const is_fumble = landed && die.kept && die.sides === 20 && die.value === 1;

        if (is_critical || is_fumble)
        {
            gpu_set_blend_add(true);
            draw_set_alpha(fade * (0.55 + 0.2 * Math.sin(t * 0.2)));
            draw_circle_colour(dx, dy, radius * 1.7, is_critical ? make_colour_rgb(255, 200, 60) : make_colour_rgb(255, 40, 40), c_black);
            gpu_set_blend_add(false);
        }
        else if (landed && die.kept && has_discarded && t >= event.spin_end + 8)
        {
            draw_set_alpha(fade);
            draw_set_colour(event.accent);
            draw_circle(dx, dy, radius * 1.28, true);
            draw_circle(dx, dy, radius * 1.28 + 1, true);
        }

        dice_draw_die(die.sides, dx, dy, radius * pop, angle, squash, die_colour, die_alpha);

        // Durante o giro, os números trocam cada vez mais devagar
        const value = landed ? die.value : ((Math.floor(t / (2 + Math.floor(ease * 5))) * 7 + i * 5 + 3) % die.sides) + 1;
        let text_colour = die.text_colour;
        if (is_critical) text_colour = make_colour_rgb(150, 90, 0);
        if (is_fumble) text_colour = make_colour_rgb(170, 20, 20);

        draw_set_alpha(die_alpha);
        if (colour_get_value(text_colour) > 128)
        {
            draw_set_colour(c_black);
            draw_text_transformed(dx + 2, dy + 2, String(value), 2 * squash * pop, 2 * pop, angle);
        }
        draw_set_colour(text_colour);
        draw_text_transformed(dx, dy, String(value), 2 * squash * pop, 2 * pop, angle);
    }

    // Parcelas: [dados] [+mod] [+mod] = [total]
    if (event.show_sum && t >= event.chips_start)
    {
        const tokens = [];
        tokens.push({ text: String(dice_sum), label: event.dice_label, at: event.chips_start, kind: 'value' });

        event.modifiers.forEach((modifier, i) =>
        {
            tokens.push({ text: format_modifier(modifier.value), label: modifier.label, at: event.chips_start + (i + 1) * 9, kind: (modifier.value < 0) ? 'negative' : 'value' });
        });

        tokens.push({ text: '=', label: '', at: event.total_at, kind: 'sign' });
        tokens.push({ text: String(event.total), label: event.total_label, at: event.total_at, kind: 'total' });

        const gap = 8;
        let row_width = -gap;
        for (const token of tokens)
        {
            token.width = (token.kind === 'sign') ? 28 : Math.max(string_width(token.text) * 2, string_width(token.label)) + 24;
            row_width += token.width + gap;
        }

        let chip_x = cx - row_width / 2;
        const chip_y = y1 + height * 0.72;
        const chip_h = 64;

        for (const token of tokens)
        {
            const token_cx = chip_x + token.width / 2;
            chip_x += token.width + gap;

            if (t < token.at) continue;

            const appear = clamp((t - token.at) / 6, 0, 1);
            const token_y = chip_y + (1 - appear) * 10;
            draw_set_alpha(fade * appear);

            if (token.kind === 'sign')
            {
                ui_draw_text_shadow(token_cx, token_y, '=', c_white, 2);
                continue;
            }

            const left = token_cx - token.width / 2;
            const top = token_y - chip_h / 2;
            const border = (token.kind === 'total') ? event.accent : UI_BORDER;

            draw_set_alpha(fade * appear * 0.9);
            draw_set_colour(make_colour_rgb(18, 16, 28));
            draw_roundrect_ext(left, top, left + token.width, top + chip_h, 12, 12, false);
            draw_set_alpha(fade * appear);
            draw_set_colour(border);
            draw_roundrect_ext(left, top, left + token.width, top + chip_h, 12, 12, true);
            if (token.kind === 'total') draw_roundrect_ext(left + 1, top + 1, left + token.width - 1, top + chip_h - 1, 12, 12, true);

            let value_colour = c_white;
            if (token.kind === 'total') value_colour = event.accent;
            if (token.kind === 'negative') value_colour = make_colour_rgb(255, 110, 110);

            ui_draw_text_shadow(token_cx, top + 22, token.text, value_colour, 2);
            ui_draw_text_shadow(token_cx, top + 50, token.label, c_ltgray);
        }
    }

    // Resultado
    if (event.verdict !== '' && t >= event.verdict_at)
    {
        const verdict_t = clamp((t - event.verdict_at) / 8, 0, 1);
        draw_set_alpha(fade * verdict_t);
        ui_draw_text_shadow(cx, y1 + height * 0.9, event.verdict, event.verdict_colour, 3 + (1 - verdict_t) * 1.5);
    }

    draw_set_alpha(1);
    draw_set_colour(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
}
