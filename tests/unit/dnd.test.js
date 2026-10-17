import { describe, expect, it } from 'vitest';
import { carregar } from '../helpers/carregar.js';

// Dados viciados: cada chamada devolve o próximo valor da fila
function dados(...valores)
{
    const fila = [...valores];
    return (a, b) =>
    {
        const v = fila.shift();
        if (v < a || v > b) throw new Error(`valor ${v} fora de ${a}..${b}`);
        return v;
    };
}

function regras(rolagens = [])
{
    return carregar(['js/scr_dnd.js'],
        ['ability_modifier', 'format_modifier', 'roll_dice', 'roll_d20', 'roll_mode_text', 'CombatState'],
        { irandom_range: dados(...rolagens) });
}

describe('ability_modifier', () =>
{
    it.each([[10, 0], [11, 0], [12, 1], [18, 4], [20, 5], [9, -1], [8, -1], [1, -5]])('valor %i -> %i', (valor, esperado) =>
    {
        expect(regras().ability_modifier(valor)).toBe(esperado);
    });
});

describe('format_modifier', () =>
{
    it('mostra sinal de + no zero e nos positivos', () =>
    {
        const { format_modifier } = regras();
        expect(format_modifier(0)).toBe('+0');
        expect(format_modifier(3)).toBe('+3');
    });
    it('mantém o sinal de - nos negativos', () => expect(regras().format_modifier(-2)).toBe('-2'));
});

describe('roll_dice', () =>
{
    it('soma os dados e descreve a rolagem', () =>
    {
        const r = regras([3, 5]).roll_dice(2, 6);
        expect(r.total).toBe(8);
        expect(r.rolls).toEqual([3, 5]);
        expect(r.text).toBe('2d6(3+5)');
    });
});

describe('roll_d20', () =>
{
    it('rolagem normal usa um dado só', () =>
    {
        const r = regras([14]).roll_d20(false, false);
        expect(r).toMatchObject({ natural: 14, rolls: [14], kept_index: 0 });
    });
    it('vantagem fica com o maior', () =>
    {
        const r = regras([4, 17]).roll_d20(true, false);
        expect(r).toMatchObject({ natural: 17, kept_index: 1 });
        expect(r.text).toContain('vantagem');
    });
    it('desvantagem fica com o menor', () =>
    {
        const r = regras([4, 17]).roll_d20(false, true);
        expect(r).toMatchObject({ natural: 4, kept_index: 0 });
    });
    it('vantagem e desvantagem juntas se anulam', () =>
    {
        expect(regras([9]).roll_d20(true, true).rolls).toHaveLength(1);
    });
});

describe('roll_mode_text', () =>
{
    it('explica cada modo', () =>
    {
        const { roll_mode_text } = regras();
        expect(roll_mode_text(true, true, 'a', 'b')).toBe('Vantagem e desvantagem se anulam');
        expect(roll_mode_text(true, false, 'Imprudente', 'b')).toBe('VANTAGEM: Imprudente');
        expect(roll_mode_text(false, true, 'a', 'Exaustão')).toBe('DESVANTAGEM: Exaustão');
        expect(roll_mode_text(false, false, 'a', 'b')).toBe('');
    });
});

describe('dificuldade_aplicar', () =>
{
    const aplicar = (dificuldade, foe) =>
    {
        const { dificuldade_aplicar } = carregar(['js/scr_dnd.js'], ['dificuldade_aplicar'], { global: { dificuldade } });
        dificuldade_aplicar(foe);
        return foe;
    };

    it.each([
        ['facil', 15, 1],
        ['normal', 22, 3],
        ['dificil', 29, 4],
        [undefined, 22, 3],   // jogo salvo antes de existir dificuldade
    ])('%s: vírus de 22 PV e +3 vira %i PV e %i', (dificuldade, pv, ataque) =>
    {
        expect(aplicar(dificuldade, { hp_max: 22, hp: 22, attack_bonus: 3 })).toMatchObject({ hp_max: pv, hp: pv, attack_bonus: ataque });
    });

    it('vale uma vez só: quem fugiu volta com a vida que sobrou', () =>
    {
        const foe = aplicar('facil', { hp_max: 22, hp: 10, attack_bonus: 3 });
        const { dificuldade_aplicar } = carregar(['js/scr_dnd.js'], ['dificuldade_aplicar'], { global: { dificuldade: 'facil' } });
        dificuldade_aplicar(foe);
        expect(foe).toMatchObject({ hp_max: 15, hp: 7, attack_bonus: 1 });
    });
});
