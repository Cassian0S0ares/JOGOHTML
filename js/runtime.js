'use strict';
// Runtime no estilo GameMaker: instâncias (com herança de objetos), rooms, tilemaps e variáveis globais.
// Cada objeto do GameMaker vira uma classe filha de Instance; os eventos viram métodos:
// create (Create), room_start (Room Start), step (Step), end_step (End Step), draw (Draw) e draw_gui (Draw GUI).

/// Variáveis globais do GML (global.*): sobrevivem à troca e ao reinício de room
const global = {};

const noone = null;

const game = {
    room: null,
    room_width: 0,
    room_height: 0,
    tile_layers: [],       // camadas de tiles da room, na ordem do arquivo
    instances: [],         // na ordem de criação, como o GameMaker roda os Steps
    pending_room: null,    // room_goto/room_restart trocam no fim do frame

    /// O antivírus da room atual (usado pelos testes E2E)
    get player() { return instance_find('obj_player'); },
};

// ---------------------------------------------------------------- Instâncias

class Instance
{
    /// Nome do objeto no GameMaker; as classes filhas herdam o pai (ex.: obj_virus_elite é filho de obj_slime)
    static object = 'obj_instance';

    constructor(x = 0, y = 0)
    {
        this.x = x;
        this.y = y;
        this.xstart = x;
        this.ystart = y;
        this.xprevious = x;
        this.yprevious = y;
        this.depth = 0;
        this.sprite_index = null;
        this.image_index = 0;
        this.image_xscale = 1;
        this.image_yscale = 1;
        this.image_angle = 0;
        this.image_blend = c_white;
        this.image_alpha = 1;
        this.destroyed = false;
    }

    get object_index() { return this.constructor.object; }

    /// Verdadeiro se a instância é do objeto ou de um filho dele (como o with/instance_exists do GML)
    is(object)
    {
        for (let c = this.constructor; c && c !== Instance; c = Object.getPrototypeOf(c))
        {
            if (c.object === object) return true;
        }
        return false;
    }

    create() {}
    room_start() {}
    step() {}
    end_step() {}
    draw() { this.draw_self(); }
    draw_gui() {}

    draw_self()
    {
        if (this.sprite_index === null) return;
        draw_sprite_ext(this.sprite_index, this.image_index, this.x, this.y, this.image_xscale, this.image_yscale,
            this.image_angle, this.image_blend, this.image_alpha);
    }

    /// Caixa de colisão retangular do sprite, já com a escala (position_meeting)
    bbox()
    {
        const spr = sprites[this.sprite_index];
        const ax = this.x + (spr.bbox[0] - spr.xo) * this.image_xscale;
        const bx = this.x + (spr.bbox[2] + 1 - spr.xo) * this.image_xscale;
        const ay = this.y + (spr.bbox[1] - spr.yo) * this.image_yscale;
        const by = this.y + (spr.bbox[3] + 1 - spr.yo) * this.image_yscale;
        return { left: Math.min(ax, bx), top: Math.min(ay, by), right: Math.max(ax, bx), bottom: Math.max(ay, by) };
    }

    contains_point(px, py)
    {
        if (this.sprite_index === null) return false;
        const b = this.bbox();
        return px >= b.left && px < b.right && py >= b.top && py < b.bottom;
    }
}

/// Cria a instância; as variáveis de props valem antes do Create (como no instance_create_depth)
function instance_create(object_class, x, y, props = {})
{
    const inst = new object_class(x, y);
    Object.assign(inst, props);
    game.instances.push(inst);
    inst.create();
    return inst;
}

function instance_destroy(inst)
{
    if (!inst || inst.destroyed) return;
    inst.destroyed = true;
    const index = game.instances.indexOf(inst);
    if (index >= 0) game.instances.splice(index, 1);
}

/// Aceita o nome de um objeto ("obj_slime", vale para os filhos) ou uma instância
function instance_exists(what)
{
    if (what === null || what === undefined) return false;
    if (typeof what === 'string') return game.instances.some((inst) => !inst.destroyed && inst.is(what));
    return !what.destroyed && game.instances.includes(what);
}

/// Todas as instâncias do objeto (e dos filhos), como num with
const instances_of = (object) => game.instances.filter((inst) => !inst.destroyed && inst.is(object));
const instance_number = (object) => instances_of(object).length;
const instance_find = (object) => instances_of(object)[0] ?? noone;

function instance_nearest(x, y, object)
{
    let best = noone;
    let best_distance = Infinity;
    for (const inst of instances_of(object))
    {
        const distance = point_distance(x, y, inst.x, inst.y);
        if (distance < best_distance)
        {
            best_distance = distance;
            best = inst;
        }
    }
    return best;
}

/// position_meeting com a caixa do sprite da instância
const position_meeting = (px, py, inst) => instance_exists(inst) && inst.contains_point(px, py);

// Sem views, a room e a GUI têm o mesmo tamanho: o mouse no mapa é o mesmo da GUI
const mouse_x_room = () => input.mouse_x;
const mouse_y_room = () => input.mouse_y;

// ---------------------------------------------------------------- Tilemaps

class Tilemap
{
    constructor(layer, tile_size)
    {
        this.name = layer.name;
        this.depth = layer.depth;
        this.visible = layer.visible;
        this.sprite = layer.sprite;
        this.width = layer.w;
        this.height = layer.h;
        this.tile_size = tile_size;
        this.tiles = layer.tiles.slice();
    }

    /// Mesmo comportamento do tilemap_get: -1 fora do tilemap
    get(cx, cy)
    {
        if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return -1;
        return this.tiles[cy * this.width + cx];
    }

    get_at_pixel(px, py) { return this.get(Math.floor(px / this.tile_size), Math.floor(py / this.tile_size)); }

    set_at_pixel(value, px, py)
    {
        const cx = Math.floor(px / this.tile_size);
        const cy = Math.floor(py / this.tile_size);
        if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) return;
        this.tiles[cy * this.width + cx] = value;
    }

    /// Desenha a camada usando a folha do tileset (índice 0 = vazio)
    draw()
    {
        const spr = sprites[this.sprite];
        const columns = Math.floor(spr.w / this.tile_size);
        const ts = this.tile_size;
        ctx.globalAlpha = 1;
        for (let i = 0; i < this.tiles.length; i++)
        {
            const tile = this.tiles[i] & 0x7FFFF;
            if (tile === 0) continue;
            ctx.drawImage(spr.img, (tile % columns) * ts, Math.floor(tile / columns) * ts, ts, ts,
                (i % this.width) * ts, Math.floor(i / this.width) * ts, ts, ts);
        }
    }
}

/// layer_tilemap_get_id(layer_get_id(nome)): -1 se a room não tem a camada
const layer_tilemap = (name) => game.tile_layers.find((layer) => layer.name === name) ?? -1;

/// Retorna true se o retângulo (em pixels, inclusivo) sai da room ou toca algum tile não vazio.
function tilemap_rect_blocked(tilemap, left, top, right, bottom)
{
    if (left < 0 || right >= game.room_width || top < 0 || bottom >= game.room_height) return true;

    // Amostra pontos com espaçamento menor que um tile, para nenhum tile passar entre eles
    const step_x = tilemap.tile_size - 1;
    const step_y = tilemap.tile_size - 1;

    for (let py = top; ; py = Math.min(py + step_y, bottom))
    {
        for (let px = left; ; px = Math.min(px + step_x, right))
        {
            if (tilemap.get_at_pixel(px, py) !== 0) return true;
            if (px >= right) break;
        }
        if (py >= bottom) break;
    }

    return false;
}

/// rectangle_in_rectangle(...) != 0
const rectangles_overlap = (a1, b1, c1, d1, a2, b2, c2, d2) => a1 <= c2 && c1 >= a2 && b1 <= d2 && d1 >= b2;

/// Move deslizando rente às paredes: se o passo inteiro bate, avança pixel a pixel até encostar
function move_with_collision(inst, move_x, move_y)
{
    if (inst.is_blocked(inst.x + move_x, inst.y))
    {
        while (!inst.is_blocked(inst.x + sign(move_x), inst.y)) inst.x += sign(move_x);
    }
    else
    {
        inst.x += move_x;
    }

    if (inst.is_blocked(inst.x, inst.y + move_y))
    {
        while (!inst.is_blocked(inst.x, inst.y + sign(move_y))) inst.y += sign(move_y);
    }
    else
    {
        inst.y += move_y;
    }
}

/// mp_grid_path sem diagonais: caminho de (x1, y1) até (x2, y2) pelos centros das células livres do tilemap.
/// Retorna a lista de pontos (começa no ponto de partida e termina no destino) ou null se não houver caminho.
function grid_path(tilemap, x1, y1, x2, y2)
{
    const ts = tilemap.tile_size;
    const columns = Math.floor(game.room_width / ts);
    const rows = Math.floor(game.room_height / ts);
    const free = (cx, cy) => cx >= 0 && cy >= 0 && cx < columns && cy < rows && tilemap.get(cx, cy) === 0;

    const start = [Math.floor(x1 / ts), Math.floor(y1 / ts)];
    const goal = [Math.floor(x2 / ts), Math.floor(y2 / ts)];
    if (!free(...start) || !free(...goal)) return null;

    // Busca em largura: com custo igual em todas as células, dá o caminho mais curto
    const key = (cx, cy) => cy * columns + cx;
    const came_from = new Map([[key(...start), null]]);
    const queue = [start];
    while (queue.length > 0)
    {
        const [cx, cy] = queue.shift();
        if (cx === goal[0] && cy === goal[1]) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!free(nx, ny) || came_from.has(key(nx, ny))) continue;
            came_from.set(key(nx, ny), [cx, cy]);
            queue.push([nx, ny]);
        }
    }
    if (!came_from.has(key(...goal))) return null;

    const cells = [];
    for (let cell = goal; cell !== null; cell = came_from.get(key(...cell))) cells.unshift(cell);

    // Pontos: a partida, o centro de cada célula do meio e o destino
    const points = [{ x: x1, y: y1 }];
    for (let i = 1; i < cells.length - 1; i++) points.push({ x: cells[i][0] * ts + ts / 2, y: cells[i][1] * ts + ts / 2 });
    points.push({ x: x2, y: y2 });
    return points;
}

// ---------------------------------------------------------------- Rooms

/// Objetos que aparecem nas rooms (preenchido pelos arquivos dos objetos)
const OBJECTS = {};

const room_goto = (name) => { game.pending_room = name; };
const room_restart = () => { game.pending_room = game.room; };

function room_load(name)
{
    const room = GAME_DATA.rooms[name];

    game.room = name;
    game.room_width = room.width;
    game.room_height = room.height;
    game.tile_layers = room.layers.map((layer) => new Tilemap(layer, room.tile_size));
    game.instances = [];

    // Create na ordem de criação da room; depois o Room Start de todo mundo
    for (const data of room.instances)
    {
        const object_class = OBJECTS[data.object];
        if (!object_class) continue;
        instance_create(object_class, data.x, data.y, { image_index: data.image_index });
    }
    for (const inst of game.instances.slice())
    {
        if (!inst.destroyed) inst.room_start();
    }
}
