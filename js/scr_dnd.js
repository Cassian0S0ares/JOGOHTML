'use strict';
// Regras de D&D 5e usadas no combate por turnos

const CombatState = Object.freeze({
    intro: 'intro',
    hero_turn: 'hero_turn',
    foe_turn: 'foe_turn',
    victory: 'victory',
    defeat: 'defeat',
    fled: 'fled',
    ally_turn: 'ally_turn',
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

// ---------------------------------------------------------------- Dificuldade (escolhida no menu, guardada em global.dificuldade)

const DIFICULDADES = Object.freeze({
    facil: { nome: 'Fácil', pv: 0.7, ataque: -2, texto: 'Vírus com 30% menos PV e que erram mais. Para focar no aprendizado.' },
    normal: { nome: 'Normal', pv: 1, ataque: 0, texto: 'O jogo como foi pensado: cada luta pede estratégia.' },
    dificil: { nome: 'Difícil', pv: 1.3, ataque: 1, texto: 'Vírus com 30% mais PV e mais certeiros. Para quem já zerou.' },
});

const dificuldade_atual = () => DIFICULDADES[global.dificuldade] ?? DIFICULDADES.normal;

/// Ajusta PV e bônus de ataque do inimigo uma vez só (quem fugiu volta com a vida que sobrou)
function dificuldade_aplicar(foe)
{
    if (foe.dificuldade_aplicada) return;
    foe.dificuldade_aplicada = true;
    const d = dificuldade_atual();
    foe.hp_max = Math.max(1, Math.round(foe.hp_max * d.pv));
    foe.hp = Math.max(1, Math.min(foe.hp_max, Math.round(foe.hp * d.pv)));
    foe.attack_bonus += d.ataque;
}
