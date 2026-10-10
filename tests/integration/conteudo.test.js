// Validação do conteúdo do jogo (sprites, sons e rooms): um dado inválido quebra o build
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carregar } from '../helpers/carregar.js';

const { GAME_DATA } = carregar(['js/data.js'], ['GAME_DATA']);

// Objetos que cada arquivo do jogo registra em OBJECTS (OBJECTS.obj_x = ... ou Object.assign(OBJECTS, { obj_x: ... }))
const fontes = ['world', 'player', 'enemies', 'firewall', 'terminal', 'inbox', 'patch', 'netfilter', 'combat', 'dialogue']
    .map((nome) => readFileSync(`js/${nome}.js`, 'utf8')).join('\n');
const OBJETOS = new Set([...fontes.matchAll(/\b(obj_\w+)(?=\s*[:=])/g)].map((m) => m[1]));

describe('sprites', () =>
{
    it.each(Object.keys(GAME_DATA.sprites))('%s tem imagem e metadados válidos', (nome) =>
    {
        const s = GAME_DATA.sprites[nome];
        expect(existsSync(`assets/sprites/${nome}.png`)).toBe(true);
        expect(s.w).toBeGreaterThan(0);
        expect(s.h).toBeGreaterThan(0);
        expect(s.n).toBeGreaterThan(0);
        expect(s.cols).toBeGreaterThan(0);
    });

    it('todo sprite citado no código existe', () =>
    {
        const codigo = readFileSync('js/combat.js', 'utf8') + fontes
            + ['scr_boss', 'scr_firewall', 'scr_quiz', 'scr_trojan', 'scr_virus_elite', 'scr_world'].map((n) => readFileSync(`js/${n}.js`, 'utf8')).join('\n');
        for (const [, nome] of codigo.matchAll(/'(spr_\w+)'/g)) expect(GAME_DATA.sprites).toHaveProperty(nome);
    });
});

describe('sons', () =>
{
    it.each(Object.keys(GAME_DATA.sounds))('%s existe', (nome) =>
    {
        expect(existsSync(`assets/sounds/${nome}.ogg`)).toBe(true);
    });
});

describe.each(GAME_DATA.room_order)('room %s', (nome) =>
{
    const room = GAME_DATA.rooms[nome];

    it('camadas de tiles têm w × h células e o tileset das visíveis existe', () =>
    {
        for (const camada of room.layers)
        {
            expect(camada.tiles).toHaveLength(camada.w * camada.h);
            if (camada.visible) expect(GAME_DATA.sprites).toHaveProperty(camada.sprite);
        }
        expect(room.layers.map((c) => c.name)).toContain('Tiles_Walls');
    });

    it('tem exatamente um jogador e só objetos conhecidos', () =>
    {
        const objetos = room.instances.map((i) => i.object);
        expect(objetos.filter((o) => o === 'obj_player')).toHaveLength(1);
        for (const o of objetos) expect(OBJETOS).toContain(o);
    });

    it('todas as instâncias estão dentro da room', () =>
    {
        for (const i of room.instances)
        {
            expect(i.x).toBeGreaterThanOrEqual(0);
            expect(i.x).toBeLessThanOrEqual(room.width);
            expect(i.y).toBeGreaterThanOrEqual(0);
            expect(i.y).toBeLessThanOrEqual(room.height);
        }
    });
});
