'use strict';
/// Telas de fim (obj_end_screen): game over quando o antivírus cai e fim de jogo quando o Cavalo de Troia é derrotado.
/// Enquanto ela está aberta o mapa fica congelado (dialogue_is_active). Enter, Espaço ou E continuam.

function end_screen_open(kind)
{
    if (instance_exists('obj_end_screen')) return;
    instance_create(EndScreen, 0, 0, { kind });
}

/// O que o jogador revisa na tela de zerar: [ameaça, lição], um item por ameaça vencida.
function end_screen_recap()
{
    return [
        ['Senhas e 2FA', 'protegem a conta mesmo quando a senha vaza.'],
        ['Phishing', 'confira remetente, link e anexo, e desconfie de pressa.'],
        ['Atualizações', 'fecham primeiro as portas que o worm usaria.'],
        ['Firewall', 'a primeira regra que combina decide; negar por padrão.'],
        ['DDoS', 'muitos pedidos ao mesmo tempo derrubam um serviço.'],
        ['Cavalo de Troia', 'parece útil, mas você mesmo o instala. Só fonte oficial.'],
    ];
}

/// Dicas do game over: uma sorteada a cada queda.
function end_screen_tips()
{
    return [
        'Esquivar faz o inimigo atacar com desvantagem (pior de dois d20).',
        'A fogueira (R) recupera PV e Fúrias, mas só sem vírus te perseguindo.',
        'Acerte o timing: no ataque dá dano extra, na defesa reduz o dano.',
        'A Fúria dá resistência: ative antes de apanhar, não depois.',
        'Ataque Imprudente dá vantagem, mas o inimigo também ganha. Use com PV cheio.',
        'Fugir também é estratégia: o vírus fica atordoado e você volta descansado.',
    ];
}

/// Tempo de jogo em mm:ss (global.passos conta os steps a 60 por segundo)
function end_screen_time()
{
    const s = Math.floor((global.passos ?? 0) / 60);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

class EndScreen extends Instance
{
    static object = 'obj_end_screen';

    create()
    {
        this.kind ??= 'gameover';
        this.timer = 0;
        this.depth = -30000;
        const tips = end_screen_tips();
        this.tip = tips[irandom(tips.length - 1)];
    }

    step()
    {
        this.timer += 1;
        if (this.timer < 60) return;   // não pula a tela com a tecla que ainda estava apertada

        if (keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space) || keyboard_check_pressed(ord('E')))
        {
            // Game over: a sala reinicia como antes. Zerou: começa tudo de novo do mundo 1.
            if (this.kind === 'win')
            {
                progresso_apagar();
                location.reload();
            }
            else room_restart();
        }
    }

    draw() {}

    draw_gui()
    {
        const fade = clamp(this.timer / 40, 0, 1);

        if (this.kind === 'win') this.draw_win(fade);
        else this.draw_gameover(fade);

        if (this.timer >= 60 && Math.floor(this.timer / 30) % 2 === 0)
        {
            draw_set_halign(fa_center);
            ui_draw_text_shadow(GUI_W / 2, GUI_H - 50, (this.kind === 'win') ? '> Enter para jogar de novo <' : '> Enter para tentar de novo <', c_white, 1.2);
        }

        draw_set_alpha(1);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
    }

    /// Moldura com cantos destacados, no estilo dos terminais
    draw_frame(x1, y1, x2, y2, fill, border)
    {
        draw_set_colour(fill);
        draw_rectangle(x1, y1, x2, y2, false);
        draw_set_colour(border);
        draw_rectangle(x1, y1, x2, y2, true);
        draw_rectangle(x1 + 4, y1 + 4, x2 - 4, y2 - 4, true);
        for (const [cx, cy] of [[x1, y1], [x2, y1], [x1, y2], [x2, y2]]) draw_rectangle(cx - 5, cy - 5, cx + 5, cy + 5, false);
    }

    /// Bits caindo ao fundo: cada coluna tem velocidade e fase próprias
    draw_binary_rain(colour, alpha)
    {
        draw_set_halign(fa_center);
        draw_set_valign(fa_top);
        draw_set_colour(colour);
        for (let col = 0; col < 34; col++)
        {
            const speed = 1 + (col * 7 % 5) * 0.4;
            const x = 20 + col * 40;
            for (let k = 0; k < 4; k++)
            {
                const y = (this.timer * speed + col * 97 + k * 210) % (GUI_H + 40) - 20;
                draw_set_alpha(alpha * (1 - k * 0.2));
                draw_text(x, y, ((col + k + Math.floor(this.timer / 20)) % 3 === 0) ? '1' : '0');
            }
        }
    }

    draw_win(fade)
    {
        const lime = c_lime;
        const cx = GUI_W / 2;

        draw_set_alpha(fade * 0.94);
        draw_set_colour(make_colour_rgb(4, 16, 10));
        draw_rectangle(0, 0, GUI_W, GUI_H, false);
        this.draw_binary_rain(lime, fade * 0.18);

        draw_set_alpha(fade);
        this.draw_frame(150, 36, GUI_W - 150, GUI_H - 90, make_colour_rgb(6, 24, 14), make_colour_rgb(0, 150, 60));

        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);
        const pulse = 0.5 + 0.5 * Math.sin(this.timer * 0.08);
        ui_draw_text_shadow(cx, 96, 'REDE PROTEGIDA', merge_colour(lime, c_white, pulse * 0.35), 4);
        ui_draw_text_shadow(cx, 152, 'O Cavalo de Troia foi encerrado e o data center está seguro.', c_white, 1.2);

        // Esquerda: o herói e a ficha da partida
        const left = 200;
        draw_sprite_ext('spr_senatir_face_01', 0, left, 196, 0.36, 0.36, 0, c_white, fade);
        draw_set_colour(make_colour_rgb(0, 150, 60));
        draw_rectangle(left, 196, left + 233, 196 + 216, true);

        draw_set_halign(fa_left);
        const stats = [
            ['Dificuldade', dificuldade_atual().nome],
            ['Tempo', end_screen_time()],
            ['Quedas', String(global.derrotas ?? 0)],
        ];
        stats.forEach(([label, value], i) =>
        {
            ui_draw_text_shadow(left, 446 + i * 30, label, c_ltgray, 1);
            ui_draw_text_shadow(left + 120, 446 + i * 30, value, c_yellow, 1.2);
        });

        // Direita: as lições, aparecendo uma a uma
        const right = 500;
        ui_draw_text_shadow(right, 210, 'O que você levou desta jornada:', c_yellow, 1.2);
        const recap = end_screen_recap();
        recap.forEach(([title, lesson], i) =>
        {
            const shown = clamp((this.timer - 40 - i * 15) / 15, 0, 1);
            if (shown <= 0) return;
            const y = 262 + i * 58;
            draw_set_alpha(fade * shown);
            draw_set_colour(lime);
            draw_rectangle(right, y - 15, right + 11, y - 4, false);
            ui_draw_text_shadow(right + 26, y - 9, title, lime, 1.2);
            ui_draw_text_shadow(right + 26, y + 14, lesson, c_ltgray, 1);
        });
        draw_set_alpha(fade);
    }

    draw_gameover(fade)
    {
        const cx = GUI_W / 2;
        const red = make_colour_rgb(255, 50, 60);

        draw_set_alpha(fade * 0.88);
        draw_set_colour(make_colour_rgb(20, 2, 6));
        draw_rectangle(0, 0, GUI_W, GUI_H, false);

        // Faixas de interferência que pulam de lugar de tempos em tempos
        if (this.timer % 40 < 8)
        {
            draw_set_colour(red);
            for (let i = 0; i < 4; i++)
            {
                draw_set_alpha(fade * random_range(0.05, 0.15));
                const y = irandom(GUI_H);
                draw_rectangle(0, y, GUI_W, y + irandom_range(2, 14), false);
            }
        }

        draw_set_alpha(fade);
        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);

        // Título com falha de sinal: cópias deslocadas em ciano e vermelho piscando
        const glitch = (this.timer % 50) < 6;
        if (glitch)
        {
            draw_set_alpha(fade * 0.6);
            ui_draw_text_shadow(cx - 6, 210, 'SISTEMA COMPROMETIDO', c_aqua, 4);
            ui_draw_text_shadow(cx + 6, 214, 'SISTEMA COMPROMETIDO', c_fuchsia, 4);
            draw_set_alpha(fade);
        }
        ui_draw_text_shadow(cx + (glitch ? irandom_range(-3, 3) : 0), 212, 'SISTEMA COMPROMETIDO', red, 4);
        ui_draw_text_shadow(cx, 290, 'O antivírus caiu. A sala vai reiniciar.', c_white, 1.2);

        // Dica sorteada, numa caixa de terminal
        this.draw_frame(cx - 420, 350, cx + 420, 470, make_colour_rgb(30, 6, 12), make_colour_rgb(150, 30, 40));
        ui_draw_text_shadow(cx, 385, 'DICA', c_yellow, 1.2);
        ui_draw_text_shadow(cx, 428, this.tip, c_ltgray, 1);

        const falls = global.derrotas ?? 0;
        ui_draw_text_shadow(cx, 520, 'Quedas: ' + falls + '     Dificuldade: ' + dificuldade_atual().nome, c_ltgray, 1);
        if (falls >= 3 && global.dificuldade !== 'facil')
        {
            ui_draw_text_shadow(cx, 556, 'Muitas quedas? Um novo jogo no Fácil deixa os vírus mais fracos.', c_yellow, 1);
        }
    }
}
