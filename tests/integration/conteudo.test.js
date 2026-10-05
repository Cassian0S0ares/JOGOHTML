// Validação do conteúdo do jogo (sprites e sala): um dado inválido quebra o build
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carregar } from '../helpers/carregar.js';

const { GAME_DATA } = carregar(['js/data.js'], ['GAME_DATA']);
const OBJETOS = ['obj_player', 'obj_slime', 'obj_prop'];

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
});

describe('sala', () =>
{
    it('camadas de tiles têm w × h células', () =>
    {
        for (const camada of Object.values(GAME_DATA.room.layers))
        {
            expect(camada.tiles).toHaveLength(camada.w * camada.h);
        }
    });

    it('tem exatamente um jogador e objetos conhecidos', () =>
    {
        const objetos = GAME_DATA.room.instances.map((i) => i.object);
        expect(objetos.filter((o) => o === 'obj_player')).toHaveLength(1);
        for (const o of objetos) expect(OBJETOS).toContain(o);
    });

    it('todas as instâncias estão dentro da sala', () =>
    {
        const { width, height } = GAME_DATA.room;
        for (const i of GAME_DATA.room.instances)
        {
            expect(i.x).toBeGreaterThanOrEqual(0);
            expect(i.x).toBeLessThanOrEqual(width);
            expect(i.y).toBeGreaterThanOrEqual(0);
            expect(i.y).toBeLessThanOrEqual(height);
        }
    });
});
