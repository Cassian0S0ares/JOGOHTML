'use strict';
/// Vírus de Elite (obj_virus_elite): um em cada sala da Room2. Derrotado, dá uma aulinha sobre o tema da sala.

/// Sala da Room2 onde fica o ponto (em tiles de 32 px):
/// "entrada" (onde o antivírus chega), "correio" (topo à esquerda), "salao" (meio),
/// "atualizacoes" (topo à direita), "laboratorio" (baixo à direita).
function virus_elite_region(x, y)
{
    const column = Math.floor(x / 32);
    const row = Math.floor(y / 32);

    if (column < 14) return (row < 8) ? "correio" : "entrada";
    if (column < 31) return "salao";
    return (row < 10) ? "atualizacoes" : "laboratorio";
}

/// Aulinha do Vírus de Elite derrotado. O Firewall já está no time e às vezes se mete na conversa.
/// SEGREDO: o Firewall é o Cavalo de Troia. As falas escondem pistas difíceis de pegar:
/// - ele sabe coisas que não devia (o joguinho do estagiário era de cavalo) e muda de assunto;
/// - os vírus quase entregam o "chefe" e o Firewall corta ou desconversa ("cavalo dado não se olha os dentes");
/// - o último "bzzzt" de cada um traz um setor e um byte: 0x54 0x52 0x4F 0x49 0x41 = "TROIA" em ASCII.
/// (E os Vírus de Elite só acordam quando o Firewall entra no time: ver obj_virus_elite.)
function virus_elite_lesson(x, y)
{
    const v = (text) => dialogue_line("Vírus de Elite", text, 'spr_virus_face');
    const s = (text) => dialogue_line("Senatir", text);
    const f = (text) => dialogue_line("Firewall", text, 'spr_firewall_face_01');

    switch (virus_elite_region(x, y))
    {
        case "entrada": return [
            v("Grrr... minha carapaça... rachou... Eu não sou um vírus qualquer, eu era de ELITE! Sabe como eu cheguei aqui? Com a conta de administrador do estagiário."),
            s("O estagiário era administrador?"),
            v("Era! Para instalar um joguinho. Quando ele clicou no meu anexo, eu herdei TODOS os poderes dele. Pude mexer no sistema inteiro."),
            f("Aquele joguinho de corrida de cavalo? Eu... imagino. Tem cara de jogo que estagiário instala. Parece. Sei lá."),
            v("Se ele usasse uma conta comum no dia a dia, eu ficaria preso só na pastinha dele. Isso se chama privilégio mínimo: cada um com o acesso que precisa, e só."),
            v("Conta de administrador é para administrar... não para ler e-mail... bzzzt... *permissão negada [setor 1: 0x54]*")
        ];

        case "correio": return [
            v("Argh... e eu que achei que tinha caprichado no e-mail... Esse não era phishing de qualquer um, era SPEAR phishing. Phishing sob medida."),
            v("Eu li a rede social da vítima: nome do chefe, time do coração, viagem de férias. Aí mandei \"Oi, é o Carlos, vi suas fotos de Natal, abre esse arquivo da reunião\"."),
            v("O resto um contato aqui de dentro me passou. Alguém que lê TUDO que passa pelas portas desta rede."),
            f("Credo, que tipo de gente faz isso. Fofoqueiro. Próximo assunto!"),
            s("Personalizado assim fica bem mais difícil de desconfiar."),
            v("Exato! Por isso: menos informação pública sobre você e o trabalho, e confirme pedidos estranhos por outro canal, mesmo que pareçam vir de alguém conhecido."),
            v("Eu sabia até o nome do cachorro dele... Rex... diga ao Rex... que eu sinto muito... bzzzt... *mensagem não entregue [setor 2: 0x52]*")
        ];

        case "salao": return [
            v("Impossível... eu ia criptografar o salão inteiro! Cada servidor desse vale um resgate gordo. Eu sou o primo de elite do ransomware."),
            v("Sabe o que me deixa furioso? Backup desconectado. Eu criptografo tudo, peço o resgate... e a TI só restaura a cópia de ontem e vai tomar café."),
            s("E se o backup estiver ligado na rede?"),
            v("Aí eu criptografo o backup também! HAHA! Por isso pelo menos uma cópia tem que ficar desconectada ou fora do local. E testem a restauração, backup que nunca foi testado é só esperança."),
            v("E nunca paguem resgate... nada garante que eu devolvo... nem eu confio em mim..."),
            f("Isso! Nunca aceitem nada de estranho! ...Agora, presente é diferente. Presente é educação. Cavalo dado não se olha os dentes!"),
            s("O que isso tem a ver com ransomware?"),
            f("Nada! É um ditado. Eu adoro ditados. Tenho vários. Nenhum outro sobre cavalo."),
            v("Heh... heh... bzzzt... *arquivos.criptografados [setor 3: 0x4F]*")
        ];

        case "atualizacoes": return [
            v("Rrrgh... eu explorava uma falha que ninguém conhecia, um ZERO-DAY! Zero dias de aviso para vocês se defenderem. Eu era exclusivo!"),
            v("Nem precisei procurar sozinho. Um amigo me mostrou o caminho. Ele conhece cada porta desta rede, uma por uma..."),
            f("Muita gente conhece as portas daqui. Os técnicos. O faxineiro. Eu, por profissão. Totalmente normal."),
            v("Mas aí o fabricante descobriu, soltou a correção... e virou só mais uma falha conhecida. Aí qualquer vírus usa. E quem não atualiza fica para trás."),
            s("Então a corrida é entre o patch sair e as pessoas instalarem."),
            v("Isso! Atualização automática ligada estraga minha festa. A maioria dos ataques nem usa zero-day, usa falha velha que alguém deixou para \"lembrar mais tarde\"."),
            v("Meu exploit... virou notícia velha... nada é mais triste que isso... bzzzt... *versão desatualizada [setor 4: 0x49]*")
        ];

        case "laboratorio": return [
            v("Grrk... vocês não deviam ter chegado até o laboratório... Fui eu que abri a porta 4444. Para o meu chefe entrar."),
            s("Chefe? Quem é o seu chefe?"),
            v("Heh... ele chegou aqui disfarçado de presente. Um programa bonito, útil, gratuito... todo mundo recebeu feliz. Por dentro, cheio de soldado."),
            v("Pergunta pro seu amigo aí. Ele não cuida das portas?"),
            f("Cuido! E a 4444 estava FECHADA no meu turno. Deve ter sido no turno da noite."),
            s("Você tem turno da noite?"),
            f("...Todo mundo tem um turno da noite."),
            v("Por isso o firewall de verdade vigia a SAÍDA também: programa infectado tenta ligar para casa. Conexão estranha saindo é sinal de que o inimigo já está aqui dentro."),
            v("Ele está mais perto do que vocês pensam... tão perto que... bzzzt... *conexão encerrada pelo host remoto [setor 5: 0x41]*")
        ];
    }

    return [v("Bzzzt... *arquivo excluído*")];
}
