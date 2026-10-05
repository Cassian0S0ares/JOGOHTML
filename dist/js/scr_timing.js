'use strict';
// Minijogo de timing antes de atacar (bônus de dano) e antes de receber um ataque (defesa)
// Um "evento de timing" entra na fila do combate como os eventos de dados.

// Janela de acerto, em frames para cada lado do momento certo (o jogo roda a 60 fps)
const TIMING_PERFECT_FRAMES = 1;
const TIMING_GOOD_FRAMES = 4;

// Efeitos no combate
const TIMING_ATTACK_PERFECT_DIE = 6;   // Perfeito no ataque: +1d6 de dano (dobra no crítico)
const TIMING_ATTACK_GOOD_BONUS = 2;    // Bom no ataque: +2 de dano
const TIMING_DEFEND_GOOD_BLOCK = 3;    // Bom na defesa: -3 de dano (Perfeito: metade do dano)

const TIMING_LEAD_IN = 14;             // aviso na tela antes de começar a valer
const TIMING_RESULT_FRAMES = 24;       // tempo mostrando o resultado
const TIMING_RING_START = 150;
const TIMING_RING_TARGET = 58;

const DICE_COLOUR_TIMING = make_colour_rgb(240, 196, 70);

const TimingResult = Object.freeze({ miss: 'miss', good: 'good', perfect: 'perfect' });

/// kind: "attack" (barra com cursor) ou "defend" (anel fechando no herói).
function timing_event_create(kind, data)
{
    return { type: 'timing', kind, data, result: TimingResult.miss };
}

/// Sorteia o momento certo. Chamado quando o evento chega na frente da fila.
function timing_event_prepare(event)
{
    event.timer = 0;
    event.finished_at = -1;
    event.lead_in = TIMING_LEAD_IN;

    if (event.kind === 'attack')
    {
        // O cursor atravessa a barra em 0,6 segundo; a zona muda de lugar a cada ataque
        const sweep = 36;
        event.hit_frame = event.lead_in + Math.round(random_range(0.4, 0.8) * sweep);
        event.end_frame = event.lead_in + sweep;
    }
    else
    {
        // A velocidade do anel varia para não dar para decorar o ritmo
        event.hit_frame = event.lead_in + irandom_range(20, 32);
        event.end_frame = event.hit_frame + TIMING_GOOD_FRAMES + 4;
    }
}

/// Avança um frame. Retorna true quando terminou (resultado já mostrado).
function timing_event_update(event, pressed)
{
    event.timer += 1;

    if (event.finished_at < 0)
    {
        // Apertos durante o aviso não contam; depois dele, o primeiro aperto decide (sem spam)
        if (pressed && event.timer > event.lead_in)
        {
            const offset = Math.abs(event.timer - event.hit_frame);
            if (offset <= TIMING_PERFECT_FRAMES) event.result = TimingResult.perfect;
            else if (offset <= TIMING_GOOD_FRAMES) event.result = TimingResult.good;
            else event.result = TimingResult.miss;
            event.finished_at = event.timer;
        }
        else if (event.timer >= event.end_frame)
        {
            event.result = TimingResult.miss;
            event.finished_at = event.timer;
        }
        return false;
    }

    // Apertar de novo pula o resultado
    if (pressed && event.timer - event.finished_at > 6) return true;
    return (event.timer - event.finished_at >= TIMING_RESULT_FRAMES);
}

/// [título, detalhe, cor] do resultado.
function timing_result_text(event)
{
    if (event.kind === 'attack')
    {
        switch (event.result)
        {
            case TimingResult.perfect: return ['PERFEITO!', '+1d' + TIMING_ATTACK_PERFECT_DIE + ' de dano se acertar', c_yellow];
            case TimingResult.good:    return ['BOM!', '+' + TIMING_ATTACK_GOOD_BONUS + ' de dano se acertar', c_lime];
            default:                   return ['FORA DO TEMPO', 'sem bônus de dano', c_ltgray];
        }
    }

    switch (event.result)
    {
        case TimingResult.perfect: return ['DEFESA PERFEITA!', 'dano pela metade', c_yellow];
        case TimingResult.good:    return ['DEFENDEU!', '-' + TIMING_DEFEND_GOOD_BLOCK + ' de dano', c_lime];
        default:                   return ['SEM DEFESA', 'dano completo', make_colour_rgb(255, 110, 110)];
    }
}

/// Desenha o minijogo na arena; a defesa aparece em volta do herói (hero_x, hero_y).
function timing_draw_event(event, x1, y1, x2, y2, hero_x, hero_y)
{
    const t = event.timer;
    const finished = (event.finished_at >= 0);
    const live_t = finished ? event.finished_at : t;   // o cursor/anel congela no aperto
    const cx = (x1 + x2) / 2;
    const height = y2 - y1;
    const is_attack = (event.kind === 'attack');
    const accent = is_attack ? c_orange : make_colour_rgb(255, 110, 110);

    let fade = clamp(t / 4, 0, 1);
    if (finished) fade = Math.min(fade, clamp((TIMING_RESULT_FRAMES - (t - event.finished_at)) / 5, 0, 1));

    // No ataque a barra fica por cima das barras de vida; na defesa o herói precisa aparecer
    draw_set_alpha((is_attack ? 0.65 : 0.3) * fade);
    draw_set_colour(c_black);
    draw_rectangle(x1, y1, x2, y2, false);
    draw_set_alpha(fade);

    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);

    // Aviso
    const title_y = y1 + height * 0.1;
    const pulse = (t <= event.lead_in) ? 0.3 * Math.abs(Math.sin(t * 0.2)) : 0;
    ui_draw_text_shadow(cx, title_y, is_attack ? 'GOLPE NO TEMPO CERTO!' : 'DEFENDA!', accent, 2 + pulse);
    ui_draw_text_shadow(cx, title_y + 34, is_attack
        ? 'Espaço, Enter ou clique com o cursor na zona dourada'
        : 'Espaço, Enter ou clique quando o anel encostar no círculo', c_ltgray);

    if (is_attack)
    {
        // Barra com cursor
        const bar_w = Math.min(460, x2 - x1 - 80);
        const bar_h = 30;
        const bar_x = cx - bar_w / 2;
        const bar_y = y1 + height * 0.3;
        const sweep = event.end_frame - event.lead_in;
        const zone_x = bar_x + (event.hit_frame - event.lead_in) / sweep * bar_w;
        const good_half = (TIMING_GOOD_FRAMES + 0.5) / sweep * bar_w;
        const perfect_half = (TIMING_PERFECT_FRAMES + 0.5) / sweep * bar_w;

        draw_set_colour(make_colour_rgb(18, 16, 28));
        draw_rectangle(bar_x, bar_y, bar_x + bar_w, bar_y + bar_h, false);
        draw_set_colour(make_colour_rgb(150, 90, 30));
        draw_rectangle(zone_x - good_half, bar_y, zone_x + good_half, bar_y + bar_h, false);
        draw_set_colour(DICE_COLOUR_TIMING);
        draw_rectangle(zone_x - perfect_half, bar_y, zone_x + perfect_half, bar_y + bar_h, false);
        draw_set_colour(UI_BORDER);
        draw_rectangle(bar_x, bar_y, bar_x + bar_w, bar_y + bar_h, true);

        if (live_t > event.lead_in || finished)
        {
            const cursor_x = bar_x + clamp((live_t - event.lead_in) / sweep, 0, 1) * bar_w;
            draw_set_colour(c_white);
            draw_rectangle(cursor_x - 2, bar_y - 8, cursor_x + 2, bar_y + bar_h + 8, false);
            draw_triangle(cursor_x - 8, bar_y - 18, cursor_x + 8, bar_y - 18, cursor_x, bar_y - 8);
        }
    }
    else
    {
        // Anel fechando em volta do herói
        const approach = event.hit_frame - event.lead_in;
        const speed = (TIMING_RING_START - TIMING_RING_TARGET) / approach;
        const ring = clamp(TIMING_RING_TARGET + (event.hit_frame - Math.max(live_t, event.lead_in)) * speed, 0, TIMING_RING_START);

        // Faixa onde o aperto ainda conta como defesa
        draw_set_alpha(fade * 0.35);
        draw_set_colour(make_colour_rgb(150, 90, 30));
        draw_ring(hero_x, hero_y, TIMING_RING_TARGET, (TIMING_GOOD_FRAMES + 0.5) * speed * 2);
        draw_set_alpha(fade);
        draw_set_colour(DICE_COLOUR_TIMING);
        draw_ring(hero_x, hero_y, TIMING_RING_TARGET, 4);

        const blink = (t <= event.lead_in && Math.floor(t / 6) % 2 === 0) ? 0.4 : 1;
        draw_set_alpha(fade * blink);
        draw_set_colour(accent);
        draw_ring(hero_x, hero_y, ring, 6);
        draw_set_alpha(fade);
    }

    // Resultado
    if (finished)
    {
        const texts = timing_result_text(event);
        const k = clamp((t - event.finished_at) / 5, 0, 1);
        const result_y = is_attack ? y1 + height * 0.55 : y1 + height * 0.3;
        ui_draw_text_shadow(cx, result_y, texts[0], texts[2], 3 + (1 - k) * 1.5);
        ui_draw_text_shadow(cx, result_y + 40, texts[1], c_white);
    }

    draw_set_alpha(1);
    draw_set_colour(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
}
