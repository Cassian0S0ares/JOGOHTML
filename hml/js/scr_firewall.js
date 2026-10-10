'use strict';
/// Firewall: Mago 3 (Escola de Evocação), aliado do antivírus no combate. Tudo nele é fogo.
/// A ficha é um struct guardado no obj_player (ally); o obj_combat lê e escreve nela.

function firewall_create()
{
    const firewall = {
        char_name: "Firewall",
        char_class: "Mago 3 - Evocação",
        level: 3,
        proficiency_bonus: 2,

        // Conjunto padrão (15, 14, 13, 12, 10, 8) + 1 em tudo (humano), Inteligência em primeiro
        strength: 9,
        dexterity: 15,
        constitution: 14,
        intelligence: 16,
        wisdom: 13,
        charisma: 11,

        // Espaços de magia do Mago 3: quatro de 1º círculo e dois de 2º
        slots_1_max: 4,
        slots_1: 4,
        slots_2_max: 2,
        slots_2: 2,

        // Poção de Brasa Viva: 2d4+2 PV; ele reacende as poções na fogueira do descanso
        potions_max: 2,
        potions: 2,
        potion_dice_count: 2,
        potion_dice_sides: 4,
        potion_bonus: 2,

        // Itens da ficha (as poções aparecem à parte, com a contagem)
        items: [
            { name: "Cajado de Brasa", short: "foco arcano" },
            { name: "Manto de Brasas", short: "CA 13+DES" },
            { name: "Grimório das Cinzas", short: "magias" },
            { name: "Amuleto de Salamandra", short: "" }
        ]
    };

    // PV: d6 cheio no 1º nível + média (4) nos níveis 2 e 3, sempre + Constituição
    firewall.hp_max = (6 + ability_modifier(firewall.constitution)) + (firewall.level - 1) * (4 + ability_modifier(firewall.constitution));
    firewall.hp = firewall.hp_max;

    // Manto de Brasas: Armadura Arcana sempre acesa, 13 + Destreza
    firewall.armor_class = 13 + ability_modifier(firewall.dexterity);

    firewall.spell_attack_bonus = ability_modifier(firewall.intelligence) + firewall.proficiency_bonus;
    firewall.spell_save_dc = 8 + firewall.spell_attack_bonus;

    firewall.get_hp_max = () => firewall.hp_max;

    return firewall;
}

/// O que atravessa o portal junto com a ficha do antivírus.
function firewall_save(firewall)
{
    return {
        hp: firewall.hp,
        slots_1: firewall.slots_1,
        slots_2: firewall.slots_2,
        potions: firewall.potions
    };
}

function firewall_load(firewall, state)
{
    firewall.hp = clamp(state.hp, 1, firewall.hp_max);
    firewall.slots_1 = state.slots_1;
    firewall.slots_2 = state.slots_2;
    firewall.potions = state.potions;
}

function firewall_long_rest(firewall)
{
    firewall.hp = firewall.hp_max;
    firewall.slots_1 = firewall.slots_1_max;
    firewall.slots_2 = firewall.slots_2_max;
    firewall.potions = firewall.potions_max;
}

/// Verdadeiro depois que o Firewall aceita entrar no time (na Room2). Antes disso o antivírus luta sozinho.
function firewall_in_party()
{
    return global.firewall_joined === true;
}

function firewall_join()
{
    global.firewall_joined = true;
}

/// Conversa com o Firewall na Room2: três perguntas, e a última o chama para o time.
/// greeted: já se apresentou antes (o jogador saiu da conversa sem chamá-lo).
function firewall_recruit_lines(greeted)
{
    const f = (text) => dialogue_line("Firewall", text, 'spr_firewall_face_01');
    const s = (text) => dialogue_line("Senatir", text);

    const intro = greeted
        ? [
            f("Voltou! Eu SABIA. Ninguém resiste ao meu charme flamejante. Nem os detectores de fumaça.")
        ]
        : [
            f("AH! Um visitante! Espera, espera, deixa eu fazer a pose de mago... *fwoosh*"),
            f("SAUDAÇÕES, VIAJANTE! Eu estava te esperando! ...Mentira, eu estava cochilando em cima do rack. Mas agora estou esperando."),
            s("...Seu chapéu está pegando fogo."),
            f("Faz parte do visual! Ele cresce de volta. Acho. Nunca conferi.")
        ];

    const who = [
        f("Eu sou o FIREWALL! Mago de fogo, guardião das portas, terror dos pacotes mal-intencionados..."),
        f("...e campeão regional de assar marshmallow em servidor superaquecido. Três anos seguidos. O troféu derreteu."),
        f("Meu nome completo é Firewall Chamas Ardentes Quentes, Porta 443. Mas pode me chamar de Fire. Ou de Wall. Ou de \"ei, você está pegando fogo\"."),
        s("E o que você faz num data center?"),
        f("Eu moro aqui! Aquele rack ali é o meu quarto. É quentinho e as ventoinhas fazem barulho de mar. Muito relaxante.")
    ];

    const what = [
        f("Ótima pergunta! Eu fico na porta da rede, igual segurança de balada. Todo pacote que chega, eu olho bem no fundo dos olhos dele."),
        f("\"Você está na lista?\" Está? Pode passar. Não está? FOGO NELE! ...Não literalmente. Às vezes literalmente."),
        f("Eu sigo regras: o que a casa pediu, entra. Conexão de fora querendo entrar sem convite, numa porta que ninguém abriu? Bloqueada. Tchau. Beijo."),
        f("E também vigio quem SAI. Se um programa daqui de dentro começa a mandar dados para um lugar esquisito, eu desconfio. Sou desconfiado. É meu trabalho e meu hobby."),
        s("Então você é tipo um porteiro mágico."),
        f("PORTEIRO NÃO! Guardião Arcano das Portas Lógicas! ...Mas sim. É basicamente porteiro. Com fogo.")
    ];

    const join = [
        s("Tem alguma coisa destruindo este lugar. Quer se juntar ao time?"),
        f("Se eu quero... SE EU QUERO?! Espera, deixa eu fingir que estou pensando para parecer misterioso."),
        f("..."),
        f("SIM! MIL VEZES SIM! Eu sempre quis ter um time! Vou fazer camisetas! Com chamas! Elas vão pegar fogo, mas é o estilo."),
        f("Antivírus e Firewall juntos: você limpa o que entrou, eu não deixo entrar. Somos a DEFESA EM CAMADAS! Li isso num livro. O livro pegou fogo, mas eu li antes."),
        s("...Bem-vindo ao time, eu acho."),
        f("*O Firewall entrou para o time!* Pode deixar que eu cuido da retaguarda. E do churrasco.")
    ];

    const choice = dialogue_choice("Senatir", "(O que perguntar para o mago de chapéu em chamas?)", [
        dialogue_option("Quem é você?", who),
        dialogue_option("Pra que você serve?", what),
        dialogue_option("Quer se juntar ao time?", join, true, firewall_join)
    ]);

    intro.push(choice);
    return intro;
}
