'use strict';
// Regras de D&D 5e usadas no combate por turnos

const CombatState = Object.freeze({
    intro: 'intro',
    hero_turn: 'hero_turn',
    foe_turn: 'foe_turn',
    victory: 'victory',
    defeat: 'defeat',
    fled: 'fled',
});

/// Modificador de atributo: (valor - 10) / 2, arredondado para baixo.
const ability_modifier = (score) => Math.floor((score - 10) / 2);

/// Formata um modificador com sinal, ex.: +3, -1.
const format_modifier = (value) => (value >= 0) ? '+' + value : String(value);

/// Rola count dados de sides lados. Retorna { total, rolls, sides, text }, ex.: text = "2d6(3+5)".
function roll_dice(count, sides)
{
    const rolls = [];
    for (let i = 0; i < count; i++) rolls.push(irandom_range(1, sides));
    return {
        total: rolls.reduce((a, b) => a + b, 0),
        rolls,
        sides,
        text: count + 'd' + sides + '(' + rolls.join('+') + ')',
    };
}

/// Rola um d20 com vantagem/desvantagem (as duas juntas se anulam).
/// Retorna { natural, rolls, kept_index, text }; kept_index é o dado que valeu.
function roll_d20(advantage, disadvantage)
{
    const first = irandom_range(1, 20);

    if (advantage === disadvantage)
    {
        return { natural: first, rolls: [first], kept_index: 0, text: 'd20(' + first + ')' };
    }

    const second = irandom_range(1, 20);
    const natural = advantage ? Math.max(first, second) : Math.min(first, second);
    const label = advantage ? 'vantagem' : 'desvantagem';

    return {
        natural,
        rolls: [first, second],
        kept_index: (first === natural) ? 0 : 1,
        text: 'd20 ' + label + '(' + first + ',' + second + ')',
    };
}

/// Texto exibido acima dos dados explicando vantagem/desvantagem.
function roll_mode_text(advantage, disadvantage, advantage_reason, disadvantage_reason)
{
    if (advantage && disadvantage) return 'Vantagem e desvantagem se anulam';
    if (advantage) return 'VANTAGEM: ' + advantage_reason;
    if (disadvantage) return 'DESVANTAGEM: ' + disadvantage_reason;
    return '';
}
