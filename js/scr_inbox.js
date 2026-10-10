'use strict';
/// Minijogo da caixa de entrada (Room2, sala do topo à esquerda): phishing ou legítimo?
/// O jogador marca as partes suspeitas do e-mail (opcional, vale pistas) e decide: Confiar ou Quarentena.
/// Acertar a decisão de todos os e-mails protege o computador.

// Campos de um e-mail, na ordem em que aparecem na tela
const INBOX_FIELD_FROM = 0;
const INBOX_FIELD_SUBJECT = 1;
const INBOX_FIELD_BODY = 2;
const INBOX_FIELD_LINK = 3;
const INBOX_FIELD_ATTACHMENT = 4;

function inbox_field_label(field)
{
    switch (field)
    {
        case INBOX_FIELD_FROM: return "De";
        case INBOX_FIELD_SUBJECT: return "Assunto";
        case INBOX_FIELD_BODY: return "Mensagem";
        case INBOX_FIELD_LINK: return "Link";
        case INBOX_FIELD_ATTACHMENT: return "Anexo";
    }
    return "";
}

/// Um e-mail. link e attachment podem ser "" (o campo não aparece).
/// clues: campos que entregam o golpe (INBOX_FIELD_*); vazio nos e-mails legítimos.
function inbox_email(from, subject, body, link, attachment, phishing, clues, explanation)
{
    return {
        values: [from, subject, body, link, attachment],
        phishing,
        clues,
        explanation
    };
}

/// A empresa é "datacenter.com.br" e o banco é "bancotuba.com.br".
function inbox_get_emails()
{
    return [
        inbox_email(
            "seguranca@bancotuuba.com.br",
            "URGENTE: sua conta será bloqueada em 1 hora!",
            "Detectamos um acesso suspeito. Confirme seus dados agora mesmo ou perderá o acesso à sua conta.",
            "http://bancotuba.com.br.verifica-conta.xyz/login",
            "",
            true, [INBOX_FIELD_FROM, INBOX_FIELD_SUBJECT, INBOX_FIELD_LINK],
            "Golpe! O remetente é \"bancotuUba\" (letra a mais), a mensagem usa pressa e medo, e o link termina em \"verifica-conta.xyz\": o domínio de verdade é o que vem logo antes da primeira barra."),

        inbox_email(
            "rh@datacenter.com.br",
            "Lembrete: confraternização na sexta às 17h",
            "Pessoal, a confraternização será no refeitório do térreo. Tragam a caneca de vocês para reduzir o lixo!",
            "",
            "",
            false, [],
            "Legítimo. Remetente da própria empresa, sem link, sem anexo, sem pedir nada. Nem todo e-mail é golpe!"),

        inbox_email(
            "suporte.ti.datacenter@gmail.com",
            "Sua senha expira hoje",
            "Para não perder o acesso, responda este e-mail com sua senha atual que nós renovamos para você.",
            "",
            "",
            true, [INBOX_FIELD_FROM, INBOX_FIELD_BODY],
            "Golpe! A TI de verdade usa o domínio da empresa, não um e-mail gratuito. E nenhum suporte legítimo pede a sua senha."),

        inbox_email(
            "financeiro@datacenter.com.br",
            "Fatura pendente de outubro",
            "Segue em anexo a fatura em aberto. Favor abrir e conferir ainda hoje.",
            "",
            "fatura_outubro.pdf.exe",
            true, [INBOX_FIELD_ATTACHMENT],
            "Golpe! O remetente parece certo (contas da empresa também são invadidas), mas o anexo termina em \".exe\": é um programa disfarçado de PDF. A extensão que vale é a última."),

        inbox_email(
            "notificacoes@bancotuba.com.br",
            "Seu extrato de setembro está disponível",
            "Consulte pelo aplicativo ou digitando o endereço do banco no navegador. Lembre-se: nunca pedimos senha por e-mail.",
            "https://www.bancotuba.com.br/extrato",
            "",
            false, [],
            "Legítimo. Domínio certo (bancotuba.com.br logo antes da primeira barra), HTTPS, sem pressa e sem pedir dados. Mesmo assim, o hábito de digitar o endereço você mesmo é ótimo."),

        inbox_email(
            "premios@sorteio-datacenter.club",
            "PARABÉNS!!! Você ganhou um celular novo",
            "Você foi sorteado! Para receber, pague só o frete de R$ 9,90 informando os dados do seu cartão.",
            "http://sorteio-datacenter.club/resgatar",
            "",
            true, [INBOX_FIELD_FROM, INBOX_FIELD_SUBJECT, INBOX_FIELD_BODY, INBOX_FIELD_LINK],
            "Golpe! Prêmio de um sorteio que você não entrou, domínio estranho, e pedido de dados do cartão. Se é bom demais para ser verdade, desconfie."),

        inbox_email(
            "diretor.carlos@datacenter-com.br.co",
            "Preciso de um favor rápido e sigiloso",
            "Estou em reunião e não posso atender. Compre 5 cartões-presente e me mande os códigos. Não comente com ninguém.",
            "",
            "",
            true, [INBOX_FIELD_FROM, INBOX_FIELD_BODY],
            "Golpe do falso chefe! O domínio é \"datacenter-com.br.co\", não o da empresa. Pedido urgente, de dinheiro e em segredo: confirme sempre por outro canal (ligue ou vá até a pessoa).")
    ];
}

/// Campos que aparecem neste e-mail (link e anexo só quando existem).
function inbox_email_fields(email)
{
    const fields = [];
    for (let i = 0; i < email.values.length; i++)
    {
        if (email.values[i] !== "") fields.push(i);
    }
    return fields;
}
