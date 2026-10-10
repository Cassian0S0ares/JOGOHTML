'use strict';
/// Mundos do jogo: falas de chegada ao atravessar um portal

/// Modo paz (tecla 7, para testes): os inimigos comuns não perseguem e encostar neles não começa luta.
/// Os chefes (DDoS e Cavalo de Troia) ignoram o modo paz, senão a história não anda.
function debug_peace()
{
    return global.peace_mode === true;
}

/// Verdadeiro durante o descanso longo (5 s na fogueira): os inimigos somem e param.
function world_resting()
{
    return instances_of('obj_player').some((player) => player.rest_timer > 0);
}

/// Fala mostrada quando o antivírus chega numa room por um portal.
function world_arrival_lines(room)
{
    const s = (text) => dialogue_line("Senatir", text);

    if (room === 'Room2') return [
        s("...Ufa. Que viagem. Acho que deixei metade dos meus pacotes no caminho."),
        s("Paredes de metal, racks piscando, cheiro de ventoinha... Eu atravessei para dentro de um data center."),
        s("Os servidores do salão do meio ainda estão de pé. Mas aquele laboratório no sudeste... alguém passou por lá e não foi com carinho."),
        s("Se o DDoS era só a porta de entrada, o que fez isso está por aqui. Melhor ficar de olho."),
        s("...E tem um sujeito de chapéu pegando fogo ali do lado, acenando para mim com as duas mãos. Ele parece... animado demais.")
    ];

    return [s("Onde é que eu vim parar?")];
}
