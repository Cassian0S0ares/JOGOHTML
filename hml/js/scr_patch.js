'use strict';
/// Minijogo da central de atualizações (Room2, sala do topo à direita): corrida contra um worm.
/// A cada atualização instalada, o worm avança um passo na rede, infectando os vizinhos sem a correção.
/// Ganha quem contém o worm antes que ele chegue nos ativos críticos.

const PATCH_SPREAD_FRAMES = 45;      // tempo da animação do worm avançando

/// Um aparelho da rede. map_x e map_y vão de 0 a 1 dentro do mapa.
function patch_node(name, map_x, map_y, critical)
{
    return { name, map_x, map_y, critical, infected: false, patched: false, flash: 0 };
}

/// Uma atualização da lista. severity: 3 crítica, 2 alta, 1 média, 0 nenhuma. fixes: índices dos aparelhos que ela corrige.
function patch_update(name, severity, description, fixes)
{
    return { name, severity, description, fixes, installed: false };
}

function patch_severity_label(severity)
{
    switch (severity)
    {
        case 3: return "CRÍTICA";
        case 2: return "ALTA";
        case 1: return "MÉDIA";
    }
    return "VISUAL";
}

function patch_severity_colour(severity)
{
    switch (severity)
    {
        case 3: return c_red;
        case 2: return c_orange;
        case 1: return c_yellow;
    }
    return c_gray;
}

/// Rede do data center. O worm começa no notebook do estagiário e tem DOIS caminhos até os dados:
/// pelo roteador, e pela câmera Wi-Fi que grava direto no servidor. Desperdiçar uma única instalação já perde.
function patch_create_network()
{
    const nodes = [
        patch_node("Notebook", 0.06, 0.5, false),                 // 0: do estagiário
        patch_node("PC Recepção", 0.28, 0.12, false),             // 1
        patch_node("Impressora", 0.28, 0.5, false),               // 2
        patch_node("Roteador", 0.52, 0.3, false),                 // 3
        patch_node("Câmera IP", 0.28, 0.88, false),               // 4: no Wi-Fi, junto com o notebook
        patch_node("PC Financeiro", 0.75, 0.1, true),             // 5
        patch_node("Servidor de Arquivos", 0.7, 0.88, true),      // 6
        patch_node("Backup NAS", 0.93, 0.45, true)                // 7
    ];
    nodes[0].infected = true;

    const links = [[0, 1], [0, 2], [0, 4], [1, 3], [2, 3], [3, 5], [3, 6], [3, 7], [4, 6], [6, 7], [5, 7]];

    // A ordem embaralha as prioridades de propósito; três atualizações dizem CRÍTICA, mas só o mapa diz qual corre perigo primeiro
    const updates = [
        patch_update("Tema escuro do navegador", 0,
            "Deixa o navegador com fundo preto. Bonito, mas não corrige nenhuma falha.", []),
        patch_update("Segurança do Windows", 3,
            "Fecha a falha de compartilhamento de arquivos que o worm usa para pular de PC em PC. Vale para todos os PCs Windows.", [1, 5]),
        patch_update("Driver da impressora", 1,
            "Corrige uma falha na impressora. O worm consegue passar por ela.", [2]),
        patch_update("Firmware da câmera IP", 2,
            "A câmera do corredor está no mesmo Wi-Fi dos notebooks e grava as imagens direto no servidor de arquivos.", [4]),
        patch_update("Firmware do Backup NAS", 2,
            "Corrige o acesso remoto do NAS onde ficam as cópias de segurança.", [7]),
        patch_update("Pacote de emojis do chat", 0,
            "37 emojis novos, incluindo um servidor pegando fogo. Não corrige nada.", []),
        patch_update("Firmware do roteador", 3,
            "Falha JÁ EXPLORADA por ataques reais. Do roteador o worm alcança o Financeiro, o Servidor e o Backup de uma vez só.", [3]),
        patch_update("Patch do servidor de arquivos", 3,
            "Corrige uma falha de execução remota no servidor onde ficam os documentos da empresa.", [6])
    ];

    return { nodes, links, updates };
}

/// Instala a atualização: corrige os aparelhos ainda não infectados (o patch não remove um worm que já entrou).
function patch_install(network, update_index)
{
    const update = network.updates[update_index];
    update.installed = true;

    for (let i = 0; i < update.fixes.length; i++)
    {
        const node = network.nodes[update.fixes[i]];
        if (!node.infected) node.patched = true;
    }
}

/// O worm avança um passo: todo vizinho de um infectado que não tem a correção é infectado.
/// Retorna quantos aparelhos foram infectados agora.
function patch_spread(network)
{
    const targets = [];
    for (let i = 0; i < network.links.length; i++)
    {
        const a = network.nodes[network.links[i][0]];
        const b = network.nodes[network.links[i][1]];
        if (a.infected && !b.infected && !b.patched) targets.push(b);
        if (b.infected && !a.infected && !a.patched) targets.push(a);
    }

    let count = 0;
    for (let i = 0; i < targets.length; i++)
    {
        if (targets[i].infected) continue;
        targets[i].infected = true;
        targets[i].flash = 1;
        count += 1;
    }
    return count;
}

/// Verdadeiro se ainda existe um vizinho de infectado sem correção.
function patch_can_spread(network)
{
    for (let i = 0; i < network.links.length; i++)
    {
        const a = network.nodes[network.links[i][0]];
        const b = network.nodes[network.links[i][1]];
        if (a.infected && !b.infected && !b.patched) return true;
        if (b.infected && !a.infected && !a.patched) return true;
    }
    return false;
}

/// Quantos ativos críticos o worm já pegou.
function patch_critical_lost(network)
{
    let count = 0;
    for (let i = 0; i < network.nodes.length; i++)
    {
        if (network.nodes[i].critical && network.nodes[i].infected) count += 1;
    }
    return count;
}

function patch_infected_count(network)
{
    let count = 0;
    for (let i = 0; i < network.nodes.length; i++)
    {
        if (network.nodes[i].infected) count += 1;
    }
    return count;
}
