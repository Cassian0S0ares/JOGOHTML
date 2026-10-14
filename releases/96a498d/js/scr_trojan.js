'use strict';
/// Chefe final da Room2: o Firewall era o Cavalo de Troia.
/// Quando os três computadores da Room2 ficam protegidos, ele chama o antivírus, leva ele até o meio do salão, agradece por ter
/// ficado com a rede só para ele, se transforma (obj_boss_trojan) e a luta final começa na hora.
/// No combate ele rouba uma habilidade do antivírus a cada 3 turnos dele (nunca o ataque), guarda no máximo 2
/// e devolve a mais antiga ao roubar outra. Às vezes usa contra você o que roubou.

const TROJAN_X = 720;                 // meio do salão
const TROJAN_Y = 360;
const TROJAN_STEAL_EVERY = 3;         // rouba no 3º, 6º, 9º... turno dele
const TROJAN_MAX_STOLEN = 2;
const TROJAN_MAP_SCALE = 0.75;        // o sprite é 128x96

/// Habilidades que ele pode roubar. passive: vale sozinha enquanto estiver com ele.
function trojan_abilities()
{
    return [
        { key: "rage", name: "Fúria", passive: false },
        { key: "reckless", name: "Ataque Imprudente", passive: false },
        { key: "dodge", name: "Esquivar", passive: false },
        { key: "defense", name: "Defesa sem Armadura", passive: true }
    ];
}

function trojan_ability_name(key)
{
    const abilities = trojan_abilities();
    for (let i = 0; i < abilities.length; i++)
    {
        if (abilities[i].key === key) return abilities[i].name;
    }
    return key;
}

/// Nome curto para caber embaixo do cavalo no combate.
function trojan_ability_short_name(key)
{
    switch (key)
    {
        case "reckless": return "Imprudente";
        case "defense": return "Defesa";
    }
    return trojan_ability_name(key);
}

/// Verdadeiro depois que o Firewall tirou a fantasia (até a derrota do antivírus reiniciar a sala).
function trojan_betrayed()
{
    return global.firewall_betrayed === true;
}

function trojan_defeated()
{
    return global.trojan_beaten === true;
}

/// Verdadeiro quando todos os computadores da Room2 estão protegidos e o Firewall ainda está no time.
function trojan_should_betray()
{
    if (game.room !== 'Room2' || !firewall_in_party() || trojan_defeated()) return false;
    if (!instance_exists('obj_computer')) return false;

    return instances_of('obj_computer').every((computer) => computer.solved);
}

/// O Firewall sai do time e vira o chefe. Retorna o obj_boss_trojan criado.
function trojan_transform(x, y)
{
    global.firewall_joined = false;
    global.firewall_betrayed = true;
    global.trojan_revealed = true;
    return instance_create(TrojanBoss, x, y);
}

/// O antivírus caiu: a sala reinicia com o "Firewall" de volta no time, fingindo que nada aconteceu.
/// Os computadores continuam protegidos (computer_remember_solved), então a traição volta logo em seguida.
function trojan_reset_after_defeat()
{
    global.firewall_betrayed = false;
    global.firewall_joined = true;
}

// ---------------------------------------------------------------- Computadores da Room2 continuam protegidos depois de uma derrota

function computer_solved_key(computer)
{
    return game.room + ':' + computer.xstart + ',' + computer.ystart;
}

/// Só na Room2: a Room1 depende de refazer o quiz para acordar o DDoS.
function computer_remember_solved(computer)
{
    if (game.room !== 'Room2') return;
    if (global.solved_computers === undefined) global.solved_computers = {};
    global.solved_computers[computer_solved_key(computer)] = true;
}

function computer_was_solved(computer)
{
    if (game.room !== 'Room2' || global.solved_computers === undefined) return false;
    return global.solved_computers[computer_solved_key(computer)] === true;
}

// ---------------------------------------------------------------- Falas

/// O Firewall chama o antivírus para ir com ele até o meio do salão.
function trojan_call_lines()
{
    const f = (text) => dialogue_line("Firewall", text, 'spr_firewall_face_01');

    if (global.trojan_revealed === true) return [
        f("Ah, você de novo! Que bom. Vem, vem, o salão está esperando. Eu AMO a parte em que eu agradeço.")
    ];

    return [
        f("Ufa! Os três computadores protegidos! Que dupla, hein?"),
        f("Vem comigo, vem! No meio do salão. Tenho uma coisa MUITO especial para te dizer. Não, não é um abraço. Talvez seja.")
    ];
}

/// O Firewall chega no meio do salão e agradece. Da segunda vez (depois de uma derrota) é curtinho.
function trojan_betrayal_lines()
{
    const f = (text) => dialogue_line("Firewall", text, 'spr_firewall_face_01');
    const t = (text) => dialogue_line("Cavalo de Troia", text, 'spr_cavalo_troia_face');
    const s = (text) => dialogue_line("Senatir", text);

    if (global.trojan_revealed === true) return [
        f("Obrigado por proteger tudo de novo. Os computadores continuam fechadinhos... só pra mim."),
        t("Agora... DE VOLTA PARA DENTRO DO CAVALO.")
    ];

    return [
        f("Pronto, aqui. Olha esse salão. Golpe de phishing barrado, regra de firewall no lugar, tudo atualizado... Ninguém mais entra nessa rede. NINGUÉM."),
        f("...Ninguém de FORA, né. Quem já está dentro, fica."),
        s("Firewall?"),
        f("Obrigado. De verdade. Você derrotou os outros vírus, fechou as portas, trancou as janelas... e deixou o data center inteirinho só pra mim."),
        f("Lembra quando você me chamou para o time? Você ABRIU a porta. Eu nunca precisei invadir nada. Cavalo dado não se olha os dentes, lembra?"),
        s("...A corrida de cavalo. O turno da noite. A porta 4444."),
        f("E os setores! 0x54, 0x52, 0x4F, 0x49, 0x41. Eu assinei o crime em hexadecimal. Ninguém nunca lê os logs."),
        f("Um firewall de verdade não pede para entrar no time. Ele fica na PORTA, vigiando. Eu fiquei do seu LADO. Grande diferença."),
        f("Bom... deixa eu tirar essa fantasia. Está quente aqui dentro. E apertado. Os soldados reclamam."),
        t("EU SOU O CAVALO DE TROIA. Eu não preciso arrombar nada: vocês me carregam para dentro."),
        t("E tudo que é seu... eu posso levar também.")
    ];
}

/// A última aulinha: como um Cavalo de Troia entra e como não deixar.
function trojan_defeat_lines()
{
    const t = (text) => dialogue_line("Cavalo de Troia", text, 'spr_cavalo_troia_face');
    const s = (text) => dialogue_line("Senatir", text);

    return [
        t("Rrrrk... minhas tábuas... Os soldados estão pulando fora... traidores. Que ironia."),
        s("Por que fingir ser um firewall?"),
        t("Porque ninguém desconfia de quem diz que está protegendo. Cavalo de Troia é isso: um programa que parece útil, bonito, de graça... e por dentro carrega o ataque."),
        t("Joguinho grátis, \"acelerador de PC\", programa crackeado, anexo de presente... Vocês mesmos me instalam e ainda me dão permissão."),
        s("E como a gente se protege?"),
        t("Baixe só de fonte oficial. Desconfie de programa que pede mais acesso do que precisa. Mantenha o antivírus ligado. E vigie o que SAI da rede, como aquela porta 4444."),
        t("E nunca... nunca aceite um presente só porque ele é simpático... e assa marshmallow... bzzzt..."),
        s("Os marshmallows eram de verdade?"),
        t("Os marshmallows... eram... de verdade... *processo encerrado*")
    ];
}
