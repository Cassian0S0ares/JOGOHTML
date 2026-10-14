'use strict';
// Minijogo de ritmo do Firewall (estilo osu!): 4 notas de fogo antes de cada magia de dano.
// Um "evento de ritmo" entra na fila do combate como os eventos de dados e de timing.
// 4 de 4 acertos: buff forte. 3 de 4: buff fraco. 2 ou menos: nada.

const RHYTHM_NOTES = 4;
const RHYTHM_HIT_FRAMES = 6;          // janela de acerto para cada lado do momento certo (60 fps)
const RHYTHM_EARLY_FRAMES = 14;       // apertar mais cedo que a janela, mas não tanto, erra a nota
const RHYTHM_APPROACH_FRAMES = 42;    // tempo do anel fechando sobre a nota
const RHYTHM_LEAD_IN = 24;            // aviso na tela antes do anel da primeira nota aparecer
const RHYTHM_RESULT_FRAMES = 40;
const RHYTHM_NOTE_RADIUS = 26;

// Buff de fogo no dano da magia
const RHYTHM_STRONG_DICE = 2;
const RHYTHM_STRONG_SIDES = 6;        // 4/4: +2d6 de fogo
const RHYTHM_WEAK_DICE = 1;
const RHYTHM_WEAK_SIDES = 4;          // 3/4: +1d4 de fogo

function rhythm_event_create(data)
{
    return { type: 'rhythm', data, notes: [], hits: 0 };
}

/// Sorteia o ritmo e onde cada nota aparece. Chamado quando o evento chega na frente da fila.
function rhythm_event_prepare(event)
{
    event.timer = 0;
    event.finished_at = -1;
    event.hits = 0;
    event.notes = [];

    // Intervalos de colcheia, semínima e semínima pontuada: o ritmo muda a cada magia
    const intervals = [14, 22, 30];
    let hit_frame = RHYTHM_LEAD_IN + RHYTHM_APPROACH_FRAMES;
    let y = random_range(0.35, 0.7);

    for (let i = 0; i < RHYTHM_NOTES; i++)
    {
        if (i > 0) hit_frame += intervals[irandom(intervals.length - 1)];

        // Da esquerda para a direita, subindo e descendo como num mapa de osu!
        y = clamp(y + random_range(0.15, 0.3) * choose(-1, 1), 0.32, 0.74);
        event.notes.push({
            hit_frame,
            x: 0.2 + i * 0.2 + random_range(-0.04, 0.04),
            y,
            judged_at: -1,
            hit: false,
        });
    }
}

/// Avança um frame. Retorna true quando terminou (resultado já mostrado).
function rhythm_event_update(event, pressed)
{
    event.timer += 1;
    const t = event.timer;

    if (event.finished_at < 0)
    {
        // Nota que passou do tempo sem aperto: erro
        for (const note of event.notes)
        {
            if (note.judged_at < 0 && t > note.hit_frame + RHYTHM_HIT_FRAMES) note.judged_at = t;
        }

        // Cada aperto vale para a próxima nota; muito cedo é ignorado, um pouco cedo erra (sem spam)
        if (pressed)
        {
            for (const note of event.notes)
            {
                if (note.judged_at >= 0) continue;

                const offset = t - note.hit_frame;
                if (offset >= -RHYTHM_HIT_FRAMES)
                {
                    note.hit = true;
                    note.judged_at = t;
                    event.hits += 1;
                }
                else if (offset >= -RHYTHM_EARLY_FRAMES)
                {
                    note.judged_at = t;
                }
                break;
            }
        }

        if (event.notes[RHYTHM_NOTES - 1].judged_at >= 0) event.finished_at = t;
        return false;
    }

    // Apertar de novo pula o resultado
    if (pressed && t - event.finished_at > 10) return true;
    return (t - event.finished_at >= RHYTHM_RESULT_FRAMES);
}

/// Buff de fogo pelo número de acertos: { count, sides, text } ou undefined.
function rhythm_buff(hits)
{
    if (hits >= RHYTHM_NOTES) return { count: RHYTHM_STRONG_DICE, sides: RHYTHM_STRONG_SIDES, text: '+' + RHYTHM_STRONG_DICE + 'd' + RHYTHM_STRONG_SIDES + ' de fogo' };
    if (hits === RHYTHM_NOTES - 1) return { count: RHYTHM_WEAK_DICE, sides: RHYTHM_WEAK_SIDES, text: '+' + RHYTHM_WEAK_DICE + 'd' + RHYTHM_WEAK_SIDES + ' de fogo (fraco)' };
    return undefined;
}

/// [título, detalhe, cor] do resultado.
function rhythm_result_text(event)
{
    const count = event.hits + '/' + RHYTHM_NOTES;
    const buff = rhythm_buff(event.hits);

    if (event.hits >= RHYTHM_NOTES) return ['CHAMAS EM RITMO! ' + count, buff.text, c_yellow];
    if (buff !== undefined) return ['QUASE! ' + count, buff.text, c_orange];
    return ['FORA DO RITMO ' + count, 'sem buff', c_ltgray];
}

/// Desenha as notas na arena: o anel fecha sobre cada nota no momento de apertar.
function rhythm_draw_event(event, x1, y1, x2, y2)
{
    const t = event.timer;
    const finished = (event.finished_at >= 0);
    const cx = (x1 + x2) / 2;
    const width = x2 - x1;
    const height = y2 - y1;
    const fire = make_colour_rgb(232, 96, 32);

    let fade = clamp(t / 4, 0, 1);
    if (finished) fade = Math.min(fade, clamp((RHYTHM_RESULT_FRAMES - (t - event.finished_at)) / 6, 0, 1));

    draw_set_alpha(0.6 * fade);
    draw_set_colour(c_black);
    draw_rectangle(x1, y1, x2, y2, false);
    draw_set_alpha(fade);

    draw_set_halign(fa_center);
    draw_set_valign(fa_middle);

    // Aviso
    const title_y = y1 + height * 0.1;
    const pulse = (t <= RHYTHM_LEAD_IN) ? 0.3 * Math.abs(Math.sin(t * 0.2)) : 0;
    ui_draw_text_shadow(cx, title_y, 'RITMO DAS CHAMAS!', c_orange, 2 + pulse);
    ui_draw_text_shadow(cx, title_y + 34, 'Espaço, Enter, Z ou clique quando o anel encostar na nota', c_ltgray);

    // Notas (as mais novas por baixo, como no osu!)
    for (let i = RHYTHM_NOTES - 1; i >= 0; i--)
    {
        const note = event.notes[i];
        const nx = x1 + note.x * width;
        const ny = y1 + note.y * height;
        const appear = note.hit_frame - RHYTHM_APPROACH_FRAMES;

        if (t < appear) continue;

        if (note.judged_at < 0)
        {
            const k = clamp((t - appear) / 8, 0, 1);
            draw_set_alpha(fade * k);

            // Anel fechando: encosta na nota no hit_frame
            const approach = clamp((note.hit_frame - t) / RHYTHM_APPROACH_FRAMES, 0, 1);
            draw_set_colour(c_yellow);
            timing_draw_thick_circle(nx, ny, RHYTHM_NOTE_RADIUS * (1 + 2 * approach), 3);

            draw_set_colour(fire);
            draw_circle(nx, ny, RHYTHM_NOTE_RADIUS, false);
            draw_set_colour(c_white);
            timing_draw_thick_circle(nx, ny, RHYTHM_NOTE_RADIUS, 3);
            ui_draw_text_shadow(nx, ny, String(i + 1), c_white, 2);
        }
        else
        {
            // Acerto explode em fagulha; erro some cinza
            const age = t - note.judged_at;
            if (age > 18) continue;

            const k = age / 18;
            draw_set_alpha(fade * (1 - k));
            draw_set_colour(note.hit ? c_yellow : c_gray);
            timing_draw_thick_circle(nx, ny, RHYTHM_NOTE_RADIUS * (1 + k * (note.hit ? 0.8 : 0)), 4);
            ui_draw_text_shadow(nx, ny - RHYTHM_NOTE_RADIUS - 14 - k * 10, note.hit ? 'ACERTO' : 'ERROU', note.hit ? c_yellow : c_ltgray);
        }
    }
    draw_set_alpha(fade);

    // Contador e resultado
    ui_draw_text_shadow(cx, y2 - 24, 'Notas: ' + event.hits + '/' + RHYTHM_NOTES, c_white);

    if (finished)
    {
        const texts = rhythm_result_text(event);
        const k = clamp((t - event.finished_at) / 5, 0, 1);
        ui_draw_text_shadow(cx, y1 + height * 0.5, texts[0], texts[2], 3 + (1 - k) * 1.5);
        ui_draw_text_shadow(cx, y1 + height * 0.5 + 40, texts[1], c_white);
    }

    draw_set_alpha(1);
    draw_set_colour(c_white);
    draw_set_halign(fa_left);
    draw_set_valign(fa_top);
}
