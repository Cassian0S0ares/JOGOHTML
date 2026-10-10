'use strict';
// Mini motor no estilo GameMaker: estado de desenho, sprites, fonte bitmap, input e áudio.
// A API imita as funções do GML para o port do jogo ficar próximo do projeto original.

const GUI_W = 1366;
const GUI_H = 768;
const STEP_MS = 1000 / 60;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = GUI_W;
canvas.height = GUI_H;
ctx.imageSmoothingEnabled = false;

// ---------------------------------------------------------------- Matemática

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sign = (v) => (v > 0) - (v < 0);
const random = (n) => Math.random() * n;
const random_range = (a, b) => a + Math.random() * (b - a);
const irandom = (n) => Math.floor(Math.random() * (n + 1));
const irandom_range = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const point_distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const lengthdir_x = (len, dir) => len * Math.cos(dir * Math.PI / 180);
const lengthdir_y = (len, dir) => -len * Math.sin(dir * Math.PI / 180);
const point_direction = (x1, y1, x2, y2) => (Math.atan2(-(y2 - y1), x2 - x1) * 180 / Math.PI + 360) % 360;
const angle_difference = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
const mod = (a, n) => ((a % n) + n) % n;
const point_in_rectangle = (px, py, x1, y1, x2, y2) => px >= x1 && px <= x2 && py >= y1 && py <= y2;
const choose = (...options) => options[Math.floor(Math.random() * options.length)];

// ---------------------------------------------------------------- Cores (0xRRGGBB)

const c_white = 0xFFFFFF;
const c_black = 0x000000;
const c_red = 0xFF0000;
const c_lime = 0x00FF00;
const c_aqua = 0x00FFFF;
const c_yellow = 0xFFFF00;
const c_orange = 0xFFA040;
const c_ltgray = 0xC0C0C0;
const c_gray = 0x808080;
const c_dkgray = 0x404040;
const c_fuchsia = 0xFF00FF;

const make_colour_rgb = (r, g, b) => (r << 16) | (g << 8) | b;
const colour_r = (c) => (c >> 16) & 255;
const colour_g = (c) => (c >> 8) & 255;
const colour_b = (c) => c & 255;
const colour_get_value = (c) => Math.max(colour_r(c), colour_g(c), colour_b(c));

function merge_colour(a, b, t)
{
    return make_colour_rgb(
        Math.round(lerp(colour_r(a), colour_r(b), t)),
        Math.round(lerp(colour_g(a), colour_g(b), t)),
        Math.round(lerp(colour_b(a), colour_b(b), t)));
}

const css_cache = new Map();
function colour_css(c)
{
    let s = css_cache.get(c);
    if (!s) { s = '#' + c.toString(16).padStart(6, '0'); css_cache.set(c, s); }
    return s;
}

// ---------------------------------------------------------------- Estado de desenho

const fa_left = 'left', fa_center = 'center', fa_right = 'right';
const fa_top = 'top', fa_middle = 'middle', fa_bottom = 'bottom';

const draw_state = { colour: c_white, alpha: 1, halign: fa_left, valign: fa_top };

const draw_set_colour = (c) => { draw_state.colour = c; };
const draw_set_alpha = (a) => { draw_state.alpha = a; };
const draw_get_alpha = () => draw_state.alpha;
const draw_set_halign = (h) => { draw_state.halign = h; };
const draw_set_valign = (v) => { draw_state.valign = v; };
const gpu_set_blend_add = (on) => { ctx.globalCompositeOperation = on ? 'lighter' : 'source-over'; };
const gpu_set_texfilter = (on) => { ctx.imageSmoothingEnabled = on; };

function apply_style()
{
    ctx.globalAlpha = clamp(draw_state.alpha, 0, 1);
    ctx.fillStyle = ctx.strokeStyle = colour_css(draw_state.colour);
}

function draw_rectangle(x1, y1, x2, y2, outline)
{
    apply_style();
    if (outline)
    {
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(x1) + 0.5, Math.round(y1) + 0.5, Math.round(x2 - x1), Math.round(y2 - y1));
    }
    else
    {
        ctx.fillRect(x1, y1, x2 - x1 + 1, y2 - y1 + 1);
    }
}

function draw_ellipse(x1, y1, x2, y2, outline)
{
    apply_style();
    ctx.beginPath();
    ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
    if (outline) { ctx.lineWidth = 1; ctx.stroke(); } else ctx.fill();
}

function draw_circle(x, y, r, outline)
{
    if (r <= 0) return;
    apply_style();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (outline) { ctx.lineWidth = 1; ctx.stroke(); } else ctx.fill();
}

/// Círculo cheio com gradiente do centro (c1) para a borda (c2)
function draw_circle_colour(x, y, r, c1, c2)
{
    ctx.globalAlpha = clamp(draw_state.alpha, 0, 1);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour_css(c1));
    g.addColorStop(1, colour_css(c2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/// Anel grosso (substitui vários draw_circle de contorno empilhados)
function draw_ring(x, y, r, thickness)
{
    if (r + thickness / 2 <= 0) return;
    apply_style();
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
    ctx.stroke();
}

function draw_line_width(x1, y1, x2, y2, w)
{
    apply_style();
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.lineCap = 'butt';
}

const draw_line = (x1, y1, x2, y2) => draw_line_width(Math.round(x1), Math.round(y1) + 0.5, Math.round(x2), Math.round(y2) + 0.5, 1);

function draw_triangle(x1, y1, x2, y2, x3, y3)
{
    apply_style();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
}

/// Polígono cheio com cor e alpha próprios (substitui draw_primitive com cor por vértice)
function draw_polygon(points, colour, alpha)
{
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = colour_css(colour);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
}

function draw_roundrect_ext(x1, y1, x2, y2, rx, ry, outline)
{
    apply_style();
    const r = Math.min(rx, (x2 - x1) / 2, (y2 - y1) / 2);
    const ox = outline ? 0.5 : 0;
    x1 = Math.round(x1) + ox; y1 = Math.round(y1) + ox; x2 = Math.round(x2) + ox; y2 = Math.round(y2) + ox;
    ctx.beginPath();
    ctx.moveTo(x1 + r, y1);
    ctx.arcTo(x2, y1, x2, y2, r);
    ctx.arcTo(x2, y2, x1, y2, r);
    ctx.arcTo(x1, y2, x1, y1, r);
    ctx.arcTo(x1, y1, x2, y1, r);
    ctx.closePath();
    if (outline) { ctx.lineWidth = 1; ctx.stroke(); } else ctx.fill();
}

// ---------------------------------------------------------------- Sprites

const sprites = {};

function load_sprites()
{
    const names = Object.keys(GAME_DATA.sprites);
    return Promise.all(names.map((name) => new Promise((resolve, reject) =>
    {
        const img = new Image();
        img.onload = () => { sprites[name] = Object.assign({ name, img, tints: new Map() }, GAME_DATA.sprites[name]); resolve(); };
        img.onerror = () => reject(new Error('Falha ao carregar ' + name));
        img.src = 'assets/sprites/' + name + '.png';
    })));
}

const sprite_get_width = (s) => sprites[s].w;
const sprite_get_height = (s) => sprites[s].h;
const sprite_get_number = (s) => sprites[s].n;
const sprite_get_xoffset = (s) => sprites[s].xo;
const sprite_get_yoffset = (s) => sprites[s].yo;
const sprite_get_speed = (s) => sprites[s].speed;

/// Origem do quadro dentro da folha (ou de uma cópia tingida da folha)
function sprite_source(s, frame, colour)
{
    const spr = sprites[s];
    const f = mod(Math.floor(frame), spr.n);
    let img = spr.img;

    if (colour !== c_white)
    {
        // Tingimento multiplicativo como o image_blend do GameMaker (cache por cor)
        img = spr.tints.get(colour);
        if (!img)
        {
            img = document.createElement('canvas');
            img.width = spr.img.width;
            img.height = spr.img.height;
            const c = img.getContext('2d');
            c.drawImage(spr.img, 0, 0);
            c.globalCompositeOperation = 'multiply';
            c.fillStyle = colour_css(colour);
            c.fillRect(0, 0, img.width, img.height);
            c.globalCompositeOperation = 'destination-in';
            c.drawImage(spr.img, 0, 0);
            spr.tints.set(colour, img);
        }
    }

    // tw/th: tamanho do quadro na folha (sprites grandes saem reduzidos; o tamanho lógico continua w/h)
    const tw = spr.tw ?? spr.w;
    const th = spr.th ?? spr.h;
    return { img, sx: (f % spr.cols) * tw, sy: Math.floor(f / spr.cols) * th, tw, th, spr };
}

function draw_sprite_ext(s, frame, x, y, xscale, yscale, rot, colour, alpha)
{
    const src = sprite_source(s, frame, colour);
    const spr = src.spr;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(x, y);
    if (rot) ctx.rotate(-rot * Math.PI / 180);
    ctx.scale(xscale, yscale);
    ctx.drawImage(src.img, src.sx, src.sy, src.tw, src.th, -spr.xo, -spr.yo, spr.w, spr.h);
    ctx.restore();
}

const draw_sprite = (s, frame, x, y) => draw_sprite_ext(s, frame, x, y, 1, 1, 0, c_white, 1);

function draw_sprite_part_ext(s, frame, left, top, w, h, x, y, xscale, yscale, colour, alpha)
{
    const src = sprite_source(s, frame, colour);
    const kx = src.tw / src.spr.w;
    const ky = src.th / src.spr.h;
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.drawImage(src.img, src.sx + left * kx, src.sy + top * ky, w * kx, h * ky, x, y, w * xscale, h * yscale);
}

// ---------------------------------------------------------------- Fonte bitmap (spr_font_ui)

// A ordem bate com os frames do spr_font_ui: ASCII 32-126 e depois os acentos
const FONT_W = 9;
const FONT_H = 20;
const font_glyphs = new Map();
{
    let map = '';
    for (let code = 32; code < 127; code++) map += String.fromCharCode(code);
    map += 'ÁÀÂÃÉÊÍÓÔÕÚÇáàâãéêíóôõúç';
    [...map].forEach((ch, i) => font_glyphs.set(ch, i));
}

function wrap_text(text, width)
{
    const lines = [];
    for (const paragraph of String(text).split('\n'))
    {
        if (width === undefined || width < 0) { lines.push(paragraph); continue; }
        const max_chars = Math.max(1, Math.floor(width / FONT_W));
        let line = '';
        for (const word of paragraph.split(' '))
        {
            const candidate = (line === '') ? word : line + ' ' + word;
            if (candidate.length <= max_chars) { line = candidate; continue; }
            if (line !== '') lines.push(line);
            line = word;
            while (line.length > max_chars) { lines.push(line.slice(0, max_chars)); line = line.slice(max_chars); }
        }
        lines.push(line);
    }
    return lines;
}

const string_width = (text) => Math.max(...String(text).split('\n').map((l) => l.length)) * FONT_W;
const string_height = (text) => String(text).split('\n').length * FONT_H;
const string_height_ext = (text, sep, width) => wrap_text(text, width).length * (sep > 0 ? sep : FONT_H);

function draw_text_lines(x, y, lines, line_height, xscale, yscale, angle)
{
    const spr = sprites.spr_font_ui;
    const src = sprite_source('spr_font_ui', 0, draw_state.colour);
    const total_h = lines.length * line_height;
    let oy = 0;
    if (draw_state.valign === fa_middle) oy = -total_h / 2;
    else if (draw_state.valign === fa_bottom) oy = -total_h;

    ctx.save();
    ctx.globalAlpha = clamp(draw_state.alpha, 0, 1);
    const plain = (xscale === 1 && yscale === 1 && !angle);
    ctx.translate(plain ? Math.round(x) : x, plain ? Math.round(y) : y);
    if (angle) ctx.rotate(-angle * Math.PI / 180);
    if (!plain) ctx.scale(xscale, yscale);

    for (let i = 0; i < lines.length; i++)
    {
        const chars = [...lines[i]];
        let ox = 0;
        if (draw_state.halign === fa_center) ox = -Math.floor(chars.length * FONT_W / 2);
        else if (draw_state.halign === fa_right) ox = -chars.length * FONT_W;
        const ly = Math.round(oy + i * line_height);

        for (let c = 0; c < chars.length; c++)
        {
            const glyph = font_glyphs.get(chars[c]);
            if (glyph === undefined || glyph === 0) continue;
            ctx.drawImage(src.img, (glyph % spr.cols) * spr.w, Math.floor(glyph / spr.cols) * spr.h, spr.w, spr.h,
                ox + c * FONT_W, ly, spr.w, spr.h);
        }
    }
    ctx.restore();
}

const draw_text = (x, y, text) => draw_text_lines(x, y, String(text).split('\n'), FONT_H, 1, 1, 0);
const draw_text_transformed = (x, y, text, xs, ys, angle) => draw_text_lines(x, y, String(text).split('\n'), FONT_H, xs, ys, angle);
const draw_text_ext = (x, y, text, sep, width) => draw_text_lines(x, y, wrap_text(text, width), sep > 0 ? sep : FONT_H, 1, 1, 0);

// ---------------------------------------------------------------- Input

const vk_up = 'ArrowUp', vk_down = 'ArrowDown', vk_left = 'ArrowLeft', vk_right = 'ArrowRight';
const vk_enter = 'Enter', vk_space = 'Space', vk_escape = 'Escape';
const vk_numpad7 = 'Numpad7';
const ord = (ch) => (ch >= '0' && ch <= '9') ? 'Digit' + ch : 'Key' + ch;

const input = {
    down: new Set(),
    pressed: new Set(),
    queued: new Set(),
    mouse_x: 0,
    mouse_y: 0,
    mouse_pressed: false,
    mouse_queued: false,
};

const GAME_KEYS = new Set([vk_up, vk_down, vk_left, vk_right, vk_space, vk_enter]);

window.addEventListener('keydown', (e) =>
{
    const code = (e.code === 'NumpadEnter') ? vk_enter : e.code;
    if (GAME_KEYS.has(code)) e.preventDefault();
    audio_unlock();
    if (e.repeat) return;
    input.down.add(code);
    input.queued.add(code);
});

window.addEventListener('keyup', (e) =>
{
    input.down.delete((e.code === 'NumpadEnter') ? vk_enter : e.code);
});

window.addEventListener('blur', () => input.down.clear());

function update_mouse(e)
{
    const rect = canvas.getBoundingClientRect();
    input.mouse_x = (e.clientX - rect.left) * GUI_W / rect.width;
    input.mouse_y = (e.clientY - rect.top) * GUI_H / rect.height;
}

canvas.addEventListener('mousemove', update_mouse);
canvas.addEventListener('mousedown', (e) =>
{
    update_mouse(e);
    audio_unlock();
    if (e.button === 0) input.mouse_queued = true;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

/// Chamado no início de cada step: o que foi apertado desde o step anterior vira "pressed"
function input_begin_step()
{
    input.pressed = input.queued;
    input.queued = new Set();
    input.mouse_pressed = input.mouse_queued;
    input.mouse_queued = false;
}

const keyboard_check = (code) => input.down.has(code);
const keyboard_check_pressed = (code) => input.pressed.has(code);
const mouse_check_button_pressed = () => input.mouse_pressed;
const mb_left = 0;
const device_mouse_x_to_gui = () => input.mouse_x;
const device_mouse_y_to_gui = () => input.mouse_y;

// ---------------------------------------------------------------- Tempo

const current_time_ms = () => performance.now();

// ---------------------------------------------------------------- Áudio

// Volume do asset no GameMaker (multiplica o ganho de cada audio_play_sound)
const SOUND_VOLUME = GAME_DATA.sounds;
const sounds_playing = new Set();
const sounds_waiting_unlock = new Set();

/// O navegador só deixa tocar som depois de uma interação: o que falhou toca no primeiro clique/tecla
function audio_unlock()
{
    for (const snd of sounds_waiting_unlock)
    {
        if (!snd.stopped && !snd.paused) snd.el.play().catch(() => {});
    }
    sounds_waiting_unlock.clear();
}

function audio_play_sound(name, loop, gain = 1, pitch = 1)
{
    const el = new Audio('assets/sounds/' + name + '.ogg');
    el.loop = loop;
    el.volume = clamp(gain * (SOUND_VOLUME[name] ?? 1), 0, 1);
    if (pitch !== 1)
    {
        el.preservesPitch = false;
        el.playbackRate = pitch;
    }
    const snd = { name, el, paused: false, stopped: false };
    sounds_playing.add(snd);
    el.addEventListener('ended', () => { snd.stopped = true; sounds_playing.delete(snd); });
    el.play().catch(() => { if (loop) sounds_waiting_unlock.add(snd); });
    return snd;
}

/// Aceita o som tocando ou o nome do asset (para todos os que estiverem tocando)
function audio_stop_sound(snd)
{
    if (!snd) return;
    if (typeof snd === 'string')
    {
        for (const other of [...sounds_playing]) if (other.name === snd) audio_stop_sound(other);
        return;
    }
    snd.stopped = true;
    snd.el.pause();
    sounds_playing.delete(snd);
    sounds_waiting_unlock.delete(snd);
}

function audio_pause_sound(snd)
{
    snd.paused = true;
    snd.el.pause();
}

function audio_resume_sound(snd)
{
    snd.paused = false;
    if (!snd.stopped) snd.el.play().catch(() => sounds_waiting_unlock.add(snd));
}

const audio_is_paused = (snd) => snd.paused;

/// Como no GameMaker, um som pausado (ou esperando o primeiro clique) ainda conta como tocando
const audio_is_playing = (snd) => !!snd && !snd.stopped;
