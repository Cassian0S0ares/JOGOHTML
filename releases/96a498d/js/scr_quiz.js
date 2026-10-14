'use strict';
/// Quiz de cibersegurança dos computadores (obj_computer abre o obj_quiz)

/// Uma pergunta: enunciado, 4 alternativas, índice da certa (0-3) e a explicação mostrada depois.
function quiz_question(text, options, answer, explanation)
{
    return { text, options, answer, explanation };
}

/// Verdadeiro enquanto a tela do quiz ou outro minijogo de computador está aberta (o mapa fica congelado).
function quiz_is_active()
{
    return terminal_is_active();
}

/// Abre o quiz do computador. Ignora se já houver uma fala ou um quiz na tela.
function quiz_start(computer)
{
    if (dialogue_is_active()) return noone;

    return instance_create(Quiz, 0, 0, {
        computer,
        title: computer.quiz_title,
        questions: quiz_get_questions(computer.quiz_topic)
    });
}

/// Tema da sala de canto onde fica o ponto: 0 esquerda topo, 1 direita topo, 2 esquerda baixo, 3 direita baixo.
function quiz_topic_at(x, y)
{
    return ((x >= game.room_width / 2) ? 1 : 0) + ((y >= game.room_height / 2) ? 2 : 0);
}

function quiz_get_title(topic)
{
    switch (topic)
    {
        case 0: return "Senhas e Autenticação";
        case 1: return "Phishing e Engenharia Social";
        case 2: return "Malware e Atualizações";
        case 3: return "Redes e Privacidade";
    }
    return "Cibersegurança";
}

/// Perguntas de cada computador. 0: esquerda topo, 1: direita topo, 2: esquerda baixo, 3: direita baixo.
function quiz_get_questions(topic)
{
    switch (topic)
    {
        case 0: return [
            quiz_question("Qual destas senhas é a mais segura?",
                ["123456", "senha2024", "MeuGato", "Cavalo-Azul-Pula-Ponte!42"], 3,
                "Senhas longas, com várias palavras, números e símbolos são muito mais difíceis de adivinhar ou quebrar por força bruta."),
            quiz_question("O que é autenticação em dois fatores (2FA)?",
                ["Usar duas senhas iguais", "Pedir uma segunda prova além da senha, como um código no celular", "Trocar a senha a cada dois dias", "Fazer login em dois computadores"], 1,
                "O 2FA exige algo que você sabe (senha) e algo que você tem (celular, chave física). Mesmo com a senha vazada, o invasor fica bloqueado."),
            quiz_question("Reutilizar a mesma senha em vários sites é perigoso porque...",
                ["Se um site vazar a senha, todas as outras contas ficam expostas", "Os sites proíbem senhas repetidas", "Deixa o computador mais lento", "Não tem perigo nenhum"], 0,
                "Atacantes testam senhas vazadas em outros serviços (credential stuffing). Uma senha diferente por site evita esse efeito dominó."),
            quiz_question("Qual é o jeito mais prático de guardar muitas senhas fortes?",
                ["Num papel colado no monitor", "Num arquivo senhas.txt na área de trabalho", "Num gerenciador de senhas", "Decorar uma só e usar em tudo"], 2,
                "Gerenciadores de senhas criptografam tudo e geram senhas fortes e únicas. Você só precisa lembrar de uma senha mestra."),
            quiz_question("Um colega pede sua senha \"só para resolver uma coisa rápida\". O que fazer?",
                ["Passar, já que é colega", "Não passar: senha é pessoal e intransferível", "Mandar por e-mail", "Escrever num bilhete"], 1,
                "Ninguém legítimo precisa da sua senha. Se ele precisa de acesso, o certo é pedir uma conta própria ao responsável.")
        ];

        case 1: return [
            quiz_question("O que é phishing?",
                ["Um tipo de antivírus", "Uma mensagem falsa que tenta roubar dados se passando por alguém confiável", "Um jeito de acelerar a internet", "Um backup automático"], 1,
                "No phishing o golpista imita bancos, lojas ou colegas para fazer você clicar num link ou entregar senhas e dados."),
            quiz_question("Você recebe: \"Sua conta será bloqueada em 1 hora! Clique aqui.\" Qual é o maior sinal de golpe?",
                ["A mensagem ter um link", "A urgência e a ameaça para você agir sem pensar", "Estar escrita em português", "Ter chegado de manhã"], 1,
                "Pressa e medo são as armas favoritas da engenharia social. Na dúvida, acesse o site oficial digitando o endereço você mesmo."),
            quiz_question("Qual endereço parece suspeito para o banco \"banco.com.br\"?",
                ["https://www.banco.com.br", "https://banco.com.br/login", "https://banco-com-br.seguranca-login.xyz", "https://app.banco.com.br"], 2,
                "O que vale é o domínio principal, logo antes da primeira barra. \"seguranca-login.xyz\" não tem nada a ver com o banco."),
            quiz_question("Alguém liga dizendo ser do suporte de TI e pede o código que chegou no seu celular. O que fazer?",
                ["Passar o código, é do suporte", "Desligar e falar com o suporte pelo canal oficial", "Passar só metade do código", "Pedir para ligarem mais tarde"], 1,
                "Códigos de verificação nunca devem ser compartilhados. Isso se chama vishing (phishing por voz)."),
            quiz_question("Você achou um pendrive no estacionamento da empresa. O que fazer?",
                ["Ligar no seu computador para achar o dono", "Entregar para a equipe de TI/segurança sem conectar", "Formatar e usar", "Levar para casa"], 1,
                "Pendrives \"perdidos\" são uma isca clássica: ao conectar, eles podem instalar malware automaticamente.")
        ];

        case 2: return [
            quiz_question("O que é ransomware?",
                ["Um programa que limpa arquivos inúteis", "Um malware que sequestra seus arquivos e pede resgate", "Um firewall gratuito", "Um tipo de senha forte"], 1,
                "O ransomware criptografa os arquivos e exige pagamento. A melhor defesa é ter backups atualizados e fora do computador."),
            quiz_question("Por que é importante instalar as atualizações do sistema?",
                ["Só para mudar o visual", "Elas corrigem falhas de segurança que invasores exploram", "Para gastar menos bateria", "Não é importante"], 1,
                "Muitas atualizações fecham vulnerabilidades conhecidas. Sistemas desatualizados são alvos fáceis."),
            quiz_question("Qual é a forma mais segura de instalar programas?",
                ["Baixar de qualquer site que aparecer na busca", "Usar a loja oficial ou o site do fabricante", "Abrir o anexo que um desconhecido mandou", "Baixar versões \"crackeadas\""], 1,
                "Programas piratas e de sites duvidosos muitas vezes vêm com malware escondido (cavalo de Troia)."),
            quiz_question("Qual regra de backup é a mais recomendada?",
                ["Uma cópia no mesmo HD", "3-2-1: 3 cópias, em 2 mídias diferentes, 1 fora do local", "Nenhuma, o computador é novo", "Só fazer backup uma vez por ano"], 1,
                "Com a regra 3-2-1, mesmo que um ataque ou um incêndio destrua uma cópia, ainda sobram outras para restaurar."),
            quiz_question("Um anexo \"fatura.pdf.exe\" chegou por e-mail. O que ele provavelmente é?",
                ["Um PDF normal", "Um programa executável disfarçado de PDF", "Uma foto", "Uma planilha"], 1,
                "A extensão que vale é a última: \".exe\". Golpistas usam extensão dupla para disfarçar programas maliciosos.")
        ];

        case 3: return [
            quiz_question("Usar Wi-Fi público aberto (de café, aeroporto) exige cuidado porque...",
                ["A internet é sempre mais lenta", "Outras pessoas na rede podem tentar interceptar seus dados", "Gasta mais bateria", "É proibido por lei"], 1,
                "Em redes abertas evite acessar banco e dados sensíveis, ou use uma VPN confiável."),
            quiz_question("O que o cadeado e o \"https\" na barra do navegador indicam?",
                ["Que o site é 100% confiável", "Que a conexão com o site é criptografada", "Que o site não tem vírus", "Que o site é do governo"], 1,
                "HTTPS protege os dados no caminho, mas golpistas também usam HTTPS. Ainda é preciso conferir o endereço do site."),
            quiz_question("Qual é a função de um firewall?",
                ["Esfriar o processador", "Controlar e bloquear conexões de rede não autorizadas", "Guardar senhas", "Aumentar a velocidade do Wi-Fi"], 1,
                "O firewall filtra o tráfego que entra e sai, bloqueando acessos que não deveriam acontecer."),
            quiz_question("Qual destas informações é mais arriscada postar em rede social?",
                ["Uma foto do pôr do sol", "Seu CPF, endereço e foto do cartão de embarque", "Seu filme favorito", "Um meme"], 1,
                "Dados pessoais e documentos permitem roubo de identidade e golpes direcionados. Pense antes de postar."),
            quiz_question("Qual é a configuração mais segura para o roteador de casa?",
                ["Deixar a senha de fábrica \"admin\"", "Wi-Fi sem senha", "Trocar a senha padrão e usar criptografia WPA2 ou WPA3", "Desligar o firewall"], 2,
                "Senhas de fábrica são públicas na internet. Troque a senha e use WPA2/WPA3 para proteger a rede.")
        ];
    }

    return [];
}

/// Aulinha que o vírus derrotado dá antes de sumir, sobre o mesmo tema do computador da sala.
function quiz_get_lesson(topic)
{
    const v = (text) => dialogue_line("Vírus", text, 'spr_virus_face');
    const s = (text) => dialogue_line("Senatir", text);

    switch (topic)
    {
        case 0: return [
            v("Argh... fui derrotado... Tá bom, tá bom! Antes de eu virar lixeira, deixa eu confessar como eu invadia as contas por aqui."),
            v("Primeiro: eu testava \"123456\". Funcionava em metade das contas. A outra metade era \"senha123\". Gente, por favor."),
            v("Senha boa é COMPRIDA. Tipo \"Cavalo-Azul-Pula-Ponte!42\". Eu levaria uns três séculos para quebrar. Eu nem tenho três séculos, eu tenho 22 PV."),
            s("E se a pessoa usar a mesma senha forte em tudo?"),
            v("Aí é festa! Um site vaza, eu pego a senha e testo em todos os outros. Chave mestra de graça. Uma senha diferente para cada site, sempre."),
            v("\"Mas eu não vou lembrar de 50 senhas!\" Usa um gerenciador de senhas, ué. Ele lembra por você e eu fico chorando do lado de fora."),
            v("E o pior de tudo: o tal do 2FA. Eu acerto a senha e aí... \"digite o código enviado ao celular\". QUE CELULAR? Eu sou um vírus, eu não tenho mão!"),
            v("Último conselho... se alguém pedir sua senha \"só rapidinho\"... não passa. Nem para colega. Principalmente se o colega for eu."),
            s("Valeu pela aula... eu acho."),
            v("Diga ao computador da sala... que eu sempre achei a senha dele... muito forte... bzzzt... *arquivo excluído*")
        ];

        case 1: return [
            v("Nãããão... logo eu, o mestre do disfarce... Prezado(a) cliente, sua derrota foi CONFIRMADA. Clique aqui para cancelar."),
            s("Não vou clicar."),
            v("Ninguém clica mais... Tá bom, aulinha de despedida: isso que eu fiz se chama phishing. Eu finjo ser o banco, a loja, o chefe... e você entrega os dados."),
            v("Meu truque favorito é a PRESSA. \"Sua conta será bloqueada em 1 hora!\" Gente com pressa não pensa. Na dúvida, entra no site oficial digitando o endereço você mesmo."),
            v("E olha o endereço com carinho. \"banco.com.br\" é o banco. \"banco-com-br.seguranca-login.xyz\" sou EU de bigode falso. Vale o que vem logo antes da primeira barra."),
            v("Também ligo fingindo ser do suporte: \"oi, é da TI, me passa o código que chegou aí\". Código de verificação NÃO se passa para ninguém. Desliga e liga você no canal oficial."),
            s("E aquele pendrive largado no estacionamento?"),
            v("Era meu! Plantei com carinho! Quem acha e espeta no computador me instala na hora. Entrega pra TI e não conecta, viu?"),
            v("Parabéns, você foi o visitante número 1.000.000 a me derrotar... resgate seu prêmio... bzzzt... *mensagem movida para o spam*")
        ];

        case 2: return [
            v("Impossível... eu sou um MALWARE de respeito! Tenho até currículo! Bom... antes de ser deletado, deixa eu contar meus segredos de carreira."),
            v("Meu primo é o ransomware. Ele tranca todos os seus arquivos e pede resgate. Hobby de família. O único jeito de deixar ele sem graça é ter backup."),
            v("E backup do jeito certo: regra 3-2-1. Três cópias, em dois tipos de mídia, uma fora de casa. Uma cópia só no mesmo HD não conta, isso é só fé."),
            s("E as atualizações do sistema? São chatas..."),
            v("Chatas para VOCÊ. Para mim são uma tragédia! Cada atualização fecha uma porta por onde eu entrava. Eu vivia de \"lembrar mais tarde\"."),
            v("Eu também adoro morar em programa crackeado e site estranho de download. Baixe só da loja oficial ou do site do fabricante e eu fico sem casa."),
            v("E o meu disfarce mais lindo: \"fatura.pdf.exe\". Parece PDF, mas a extensão que manda é a ÚLTIMA. É um programa. Sou eu de terno e gravata."),
            s("Você está bem orgulhoso disso, né?"),
            v("Trabalhei muito nesse ícone... Bom, chegou a hora... estou sendo movido... para a quarentena... bzzzt... *0% concluído... para sempre*")
        ];

        case 3: return [
            v("Cof cof... perdi o sinal... Espera, antes de eu desconectar de vez, deixa eu te ensinar umas coisinhas de rede. De graça. Coisa rara pra mim."),
            v("Wi-Fi aberto de café é meu restaurante favorito. Fico na mesma rede espiando o que passa. Em rede pública, nada de banco, ou usa uma VPN confiável."),
            v("O cadeadinho do HTTPS quer dizer que a conexão é criptografada. NÃO quer dizer que o site é honesto. Eu também tenho cadeado! Comprei barato!"),
            s("E o firewall serve para quê?"),
            v("É o segurança da balada da rede. Fica na porta e barra conexão que não foi convidada. Eu passei a vida tentando entrar pelos fundos."),
            v("Agora, rede social... ah, eu amo. Gente postando CPF, endereço, foto do cartão de embarque... Eu nem preciso hackear, só preciso LER."),
            v("E roteador com senha de fábrica \"admin\"? Essa senha está na internet, eu sei de cor. Troca a senha e usa WPA2 ou WPA3, por favor. Ou não. Não, não, por favor sim."),
            s("Você está meio confuso."),
            v("É a perda de pacotes... tudo ficando... laggado... avisa minha família... que eu caí... por timeout... bzzzt... *conexão encerrada pelo host*")
        ];
    }

    return [v("Bzzzt... *arquivo excluído*")];
}
