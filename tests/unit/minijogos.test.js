import { describe, expect, it } from 'vitest';
import { carregar } from '../helpers/carregar.js';

// Lógica dos minijogos dos computadores e do ritmo do Firewall (sem desenho)

describe('regras do firewall (netfilter)', () =>
{
    const { netfilter_get_waves, netfilter_first_match, NETFILTER_MIN_CORRECT } = carregar(['js/scr_netfilter.js'],
        ['netfilter_get_waves', 'netfilter_first_match', 'NETFILTER_MIN_CORRECT']);
    const ondas = netfilter_get_waves();

    it('a última regra de toda onda é "todo o resto: bloquear"', () =>
    {
        for (const onda of ondas) expect(onda.rules.at(-1)).toMatchObject({ direction: '', port: -1, allow: false });
    });

    it('a primeira regra que combina decide (lista negra vem antes do HTTPS liberado)', () =>
    {
        const onda = ondas[1];
        const [pacote] = onda.packets;
        expect(pacote).toMatchObject({ ip: '203.0.113.66', port: 443 });
        expect(onda.rules[netfilter_first_match(onda.rules, pacote)].allow).toBe(false);
    });

    it('prefixo de IP só combina com o começo do endereço', () =>
    {
        const onda = ondas[1];
        const interno = onda.packets.find((p) => p.ip === '192.168.0.15');
        const externo = onda.packets.find((p) => p.ip === '89.44.2.10');
        expect(onda.rules[netfilter_first_match(onda.rules, interno)].allow).toBe(true);
        expect(onda.rules[netfilter_first_match(onda.rules, externo)].allow).toBe(false);
    });

    it('a meta de acertos é alcançável', () =>
    {
        const total = ondas.reduce((soma, onda) => soma + onda.packets.length, 0);
        expect(NETFILTER_MIN_CORRECT).toBeLessThanOrEqual(total);
    });
});

describe('central de atualizações (worm)', () =>
{
    const patch = carregar(['js/scr_patch.js'],
        ['patch_create_network', 'patch_install', 'patch_spread', 'patch_can_spread', 'patch_critical_lost'],
        { c_red: 1, c_orange: 2, c_yellow: 3, c_gray: 4 });
    const indice = (rede, nome) => rede.updates.findIndex((u) => u.name === nome);

    function jogar(nomes)
    {
        const rede = patch.patch_create_network();
        for (const nome of nomes)
        {
            patch.patch_install(rede, indice(rede, nome));
            patch.patch_spread(rede);
            if (patch.patch_critical_lost(rede) > 0) break;
        }
        return rede;
    }

    it('câmera e roteador primeiro contêm o worm sem perder ativo crítico', () =>
    {
        const rede = jogar(['Firmware da câmera IP', 'Firmware do roteador']);
        expect(patch.patch_critical_lost(rede)).toBe(0);
        expect(patch.patch_can_spread(rede)).toBe(false);
    });

    it('gastar a primeira instalação com o tema escuro deixa o worm chegar no servidor', () =>
    {
        const rede = jogar(['Tema escuro do navegador', 'Firmware do roteador']);
        expect(patch.patch_critical_lost(rede)).toBeGreaterThan(0);
    });

    it('a atualização não corrige um aparelho que já está infectado', () =>
    {
        const rede = patch.patch_create_network();
        patch.patch_install(rede, indice(rede, 'Segurança do Windows'));
        expect(rede.nodes[1].patched).toBe(true);
        expect(rede.nodes[0].patched).toBe(false);
    });
});

describe('caixa de entrada (phishing)', () =>
{
    const { inbox_get_emails, inbox_email_fields } = carregar(['js/scr_inbox.js'], ['inbox_get_emails', 'inbox_email_fields']);
    const emails = inbox_get_emails();

    it('golpes têm pistas e e-mails legítimos não têm', () =>
    {
        for (const email of emails) expect(email.clues.length > 0).toBe(email.phishing);
    });

    it('toda pista aponta para um campo que aparece no e-mail', () =>
    {
        for (const email of emails)
        {
            const campos = inbox_email_fields(email);
            for (const pista of email.clues) expect(campos).toContain(pista);
        }
    });
});

describe('quiz', () =>
{
    const { quiz_get_questions } = carregar(['js/scr_quiz.js'], ['quiz_get_questions']);

    it.each([0, 1, 2, 3])('tema %i tem 5 perguntas com 4 alternativas e resposta válida', (tema) =>
    {
        const perguntas = quiz_get_questions(tema);
        expect(perguntas).toHaveLength(5);
        for (const p of perguntas)
        {
            expect(p.options).toHaveLength(4);
            expect(p.answer).toBeGreaterThanOrEqual(0);
            expect(p.answer).toBeLessThan(4);
            expect(p.explanation.length).toBeGreaterThan(0);
        }
    });
});

describe('ritmo das chamas', () =>
{
    const ritmo = carregar(['js/scr_rhythm.js'],
        ['rhythm_event_create', 'rhythm_event_prepare', 'rhythm_event_update', 'rhythm_buff', 'RHYTHM_NOTES', 'RHYTHM_HIT_FRAMES'],
        {
            random_range: (a, b) => (a + b) / 2,
            irandom: () => 0,
            choose: (a) => a,
            clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
        });

    it('4 acertos dão o buff forte, 3 o fraco e menos que isso nada', () =>
    {
        expect(ritmo.rhythm_buff(4)).toMatchObject({ count: 2, sides: 6 });
        expect(ritmo.rhythm_buff(3)).toMatchObject({ count: 1, sides: 4 });
        expect(ritmo.rhythm_buff(2)).toBeUndefined();
    });

    it('apertar no momento de cada nota acerta todas', () =>
    {
        const evento = ritmo.rhythm_event_create({});
        ritmo.rhythm_event_prepare(evento);
        const momentos = new Set(evento.notes.map((n) => n.hit_frame));
        while (evento.finished_at < 0) ritmo.rhythm_event_update(evento, momentos.has(evento.timer + 1));
        expect(evento.hits).toBe(ritmo.RHYTHM_NOTES);
    });

    it('sem apertar nada, todas as notas passam como erro', () =>
    {
        const evento = ritmo.rhythm_event_create({});
        ritmo.rhythm_event_prepare(evento);
        while (evento.finished_at < 0) ritmo.rhythm_event_update(evento, false);
        expect(evento.hits).toBe(0);
        expect(evento.notes.every((n) => n.judged_at >= 0)).toBe(true);
    });
});
