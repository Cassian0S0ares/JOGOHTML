'use strict';
/// Chefe DDoS: inspirado no Pudim Negro (Black Pudding) de D&D 5e.
/// No combate ele vira um enxame de pedaços; no fim de cada turno dele, cada pedaço se divide em dois.

const BOSS_DDOS_X = 688;            // sala do meio, embaixo
const BOSS_DDOS_Y = 560;
const BOSS_DDOS_MAX_PIECES = 8;     // limite de pedaços na tela
const BOSS_DDOS_MAP_SCALE = 0.25;   // o sprite é 512x512

/// Verdadeiro quando todos os computadores estão protegidos e o chefe ainda não apareceu.
function boss_ddos_should_awaken()
{
    if (instance_exists('obj_boss_ddos')) return false;
    if (global.boss_ddos_defeated === true) return false;
    if (!instance_exists('obj_computer')) return false;

    return instances_of('obj_computer').every((computer) => computer.solved);
}

function boss_ddos_awaken()
{
    if (instance_exists('obj_boss_ddos')) return;
    instance_create(BossDdos, BOSS_DDOS_X, BOSS_DDOS_Y);
}

/// Um pedaço do enxame no combate. draw_x/draw_top são atualizados pelo Draw GUI.
function boss_piece_create(hp)
{
    return { hp, hp_max: hp, flash: 0, draw_x: 0, draw_top: 0 };
}

/// Força do pedaço pelo PV com que ele nasceu: pedaços menores batem mais fraco.
function boss_piece_tier(piece)
{
    if (piece.hp_max >= 48) return { name: "Enorme",    bludgeon_dice: 1, bludgeon_bonus: 3, acid_count: 2, acid_sides: 8 };
    if (piece.hp_max >= 24) return { name: "Grande",    bludgeon_dice: 1, bludgeon_bonus: 1, acid_count: 1, acid_sides: 8 };
    if (piece.hp_max >= 12) return { name: "Médio",     bludgeon_dice: 0, bludgeon_bonus: 0, acid_count: 1, acid_sides: 6 };
    return                          { name: "Pequeno",   bludgeon_dice: 0, bludgeon_bonus: 0, acid_count: 1, acid_sides: 4 };
}

function boss_ddos_intro_lines()
{
    const d = (text) => dialogue_line("???", text, 'spr_ddos_face');
    const s = (text) => dialogue_line("Senatir", text);

    return [
        s("Os quatro computadores estão protegidos... mas o chão está tremendo."),
        s("Tem alguma coisa na sala do meio, lá embaixo. Dá para sentir daqui."),
        d("PING. PING. PING. PING. PING. PING. PING. PING. PING. PING."),
        d("VOCÊS TRANCARAM AS SENHAS... ENSINARAM SOBRE PHISHING... ATUALIZARAM TUDO..."),
        d("ENTÃO EU NÃO VOU INVADIR. EU VOU SÓ... MANDAR UM MILHÃO DE REQUISIÇÕES POR SEGUNDO ATÉ TUDO CAIR."),
        d("EU SOU O DDoS. E EU NÃO SOU UM. EU SOU MUITOS."),
        s("...ele está falando em caixa alta de propósito, né?")
    ];
}

function boss_ddos_defeat_lines()
{
    const d = (text) => dialogue_line("DDoS", text, 'spr_ddos_face');
    const s = (text) => dialogue_line("Senatir", text);

    return [
        d("ERRO 503... SERVIÇO... INDISPONÍVEL... Eu? Indisponível? Isso era para acontecer com VOCÊS!"),
        s("Seus pedaços acabaram. Fim da inundação."),
        d("Tá bom... aulinha final, já que virou moda aqui. DDoS é negação de serviço distribuída: milhares de máquinas mandando lixo ao mesmo tempo até o servidor engasgar."),
        d("E sabe de onde vêm essas máquinas? De computador sem atualização, câmera com senha \"admin\", roteador esquecido... Eu recrutava a minha botnet com o descuido de vocês."),
        d("Quem se protege usa limite de requisições, firewall, filtro de tráfego e CDN para espalhar a carga. Aí eu bato, bato... e ninguém nem percebe. Que humilhação."),
        s("Então cada senha forte e cada atualização deixou você mais fraco."),
        d("Exatamente... foi por isso que eu me dividi tanto... achei que quantidade resolvia tudo... Diga aos servidores... que eu só queria... atenção... *timeout*")
    ];
}
