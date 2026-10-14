'use strict';
/// Minijogo das regras do firewall (Room2, sala de baixo à direita): pacotes passam numa esteira
/// e o jogador decide Permitir ou Bloquear seguindo a lista de regras. A primeira regra que combina decide;
/// o que nenhuma regra cobre é bloqueado (negar por padrão). Cada onda traz regras novas.

const NETFILTER_MIN_CORRECT = 9;      // acertos para proteger o computador (mais do que 8, de 13 pacotes)

/// Uma regra. Campos vazios (direction "", port -1, ip "", ip_prefix "") combinam com qualquer coisa.
function netfilter_rule(text, direction, port, ip, ip_prefix, allow)
{
    return { text, direction, port, ip, ip_prefix, allow };
}

/// Um pacote. direction: "in" (entrando, ip é a origem) ou "out" (saindo, ip é o destino).
function netfilter_packet(direction, ip, port, service, note)
{
    return { direction, ip, port, service, note };
}

function netfilter_rule_matches(rule, packet)
{
    if (rule.direction !== "" && rule.direction !== packet.direction) return false;
    if (rule.port !== -1 && rule.port !== packet.port) return false;
    if (rule.ip !== "" && rule.ip !== packet.ip) return false;
    if (rule.ip_prefix !== "" && !packet.ip.startsWith(rule.ip_prefix)) return false;
    return true;
}

/// Índice da primeira regra que combina com o pacote (a última é sempre "todo o resto").
function netfilter_first_match(rules, packet)
{
    for (let i = 0; i < rules.length; i++)
    {
        if (netfilter_rule_matches(rules[i], packet)) return i;
    }
    return rules.length - 1;
}

/// Etiqueta do pacote em três linhas.
function netfilter_packet_text(packet)
{
    const incoming = (packet.direction === "in");
    return (incoming ? "ENTRADA" : "SAÍDA") + "\n"
        + (incoming ? "de " : "para ") + packet.ip + "\n"
        + "porta " + String(packet.port) + " (" + packet.service + ")";
}

/// Ondas de pacotes: { rules, packets, frames }. frames: tempo de cada pacote na esteira (60 fps).
function netfilter_get_waves()
{
    const telnet = netfilter_rule("ENTRADA porta 23 (Telnet): BLOQUEAR", "in", 23, "", "", false);
    const https_in = netfilter_rule("ENTRADA porta 443 (HTTPS): PERMITIR", "in", 443, "", "", true);
    const http_in = netfilter_rule("ENTRADA porta 80 (HTTP): PERMITIR", "in", 80, "", "", true);
    const rest = netfilter_rule("Todo o resto: BLOQUEAR", "", -1, "", "", false);

    const blacklist = netfilter_rule("IP 203.0.113.66 (lista negra), entrada ou saída: BLOQUEAR", "", -1, "203.0.113.66", "", false);
    const remote = netfilter_rule("ENTRADA porta 3389 (área de trabalho remota) vinda de 192.168.*: PERMITIR", "in", 3389, "", "192.168.", true);

    const https_out = netfilter_rule("SAÍDA porta 443 (HTTPS): PERMITIR", "out", 443, "", "", true);
    const dns_out = netfilter_rule("SAÍDA porta 53 (DNS): PERMITIR", "out", 53, "", "", true);
    const backdoor = netfilter_rule("SAÍDA porta 4444: BLOQUEAR", "out", 4444, "", "", false);

    return [
        {
            frames: 600,
            rules: [telnet, https_in, http_in, rest],
            packets: [
                netfilter_packet("in", "198.51.100.7", 443, "HTTPS", "Um visitante abrindo o site da empresa. Regra do HTTPS: pode passar."),
                netfilter_packet("in", "45.33.12.9", 23, "Telnet", "Telnet manda tudo sem criptografia, até a senha. Bloqueado!"),
                netfilter_packet("in", "172.16.8.20", 80, "HTTP", "Acesso normal ao site. Regra do HTTP: pode passar."),
                netfilter_packet("in", "91.200.4.4", 21, "FTP", "Nenhuma regra fala da porta 21, então vale o \"todo o resto\": bloqueado. Isso é negar por padrão: só passa o que foi liberado.")
            ]
        },
        {
            frames: 540,
            rules: [blacklist, remote, telnet, https_in, http_in, rest],
            packets: [
                netfilter_packet("in", "203.0.113.66", 443, "HTTPS", "A porta 443 é liberada, mas a regra 1 vem antes: IP da lista negra é barrado. A PRIMEIRA regra que combina decide."),
                netfilter_packet("in", "192.168.0.15", 3389, "Área remota", "Funcionário da rede interna (192.168.*) usando a área de trabalho remota. Liberado."),
                netfilter_packet("in", "89.44.2.10", 3389, "Área remota", "Área de trabalho remota vinda da internet não está liberada: bloqueado. Esse é um dos caminhos favoritos do ransomware."),
                netfilter_packet("in", "203.0.113.67", 80, "HTTP", "Olho vivo: termina em .67, não .66. Não está na lista negra, e o HTTP é liberado.")
            ]
        },
        {
            frames: 480,
            rules: [blacklist, remote, telnet, https_in, http_in, https_out, dns_out, backdoor, rest],
            packets: [
                netfilter_packet("out", "142.250.78.14", 443, "HTTPS", "Alguém da empresa abrindo um site seguro. Saída HTTPS liberada."),
                netfilter_packet("out", "203.0.113.66", 53, "DNS", "DNS de saída é liberado, mas o destino está na lista negra, e a regra 1 vale nos dois sentidos."),
                netfilter_packet("out", "77.91.3.120", 4444, "???", "Porta 4444 saindo é típica de backdoor: um programa infectado tentando falar com o atacante. Tem um Cavalo de Troia aqui dentro!"),
                netfilter_packet("out", "8.8.8.8", 53, "DNS", "Consulta de DNS normal, é ela que transforma nomes de site em endereços. Liberado."),
                netfilter_packet("out", "45.9.1.2", 6667, "IRC", "Nenhuma regra libera: bloqueado. A porta 6667 (IRC) é usada por botnets para receber ordens.")
            ]
        }
    ];
}
