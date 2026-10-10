'use strict';
/// Telas de fim (obj_end_screen): game over quando o antivírus cai e fim de jogo quando o Cavalo de Troia é derrotado.
/// Enquanto ela está aberta o mapa fica congelado (dialogue_is_active). Enter, Espaço ou E continuam.

function end_screen_open(kind)
{
    if (instance_exists('obj_end_screen')) return;
    instance_create(EndScreen, 0, 0, { kind });
}

/// O que o jogador revisa na tela de zerar: um item por ameaça vencida.
function end_screen_recap()
{
    return [
        'Senhas fortes e 2FA protegem contas mesmo quando a senha vaza.',
        'Phishing: confira remetente, link, anexo e desconfie de pressa.',
        'Atualizações fecham as portas que o worm usaria primeiro.',
        'Firewall: a primeira regra que combina decide; negar por padrão.',
        'DDoS: muitos pedidos ao mesmo tempo derrubam um serviço.',
        'Cavalo de Troia: parece útil, mas você mesmo o instala. Baixe só de fonte oficial.'
    ];
}

class EndScreen extends Instance
{
    static object = 'obj_end_screen';

    create()
    {
        this.kind ??= 'gameover';
        this.timer = 0;
        this.depth = -30000;
    }

    step()
    {
        this.timer += 1;
        if (this.timer < 60) return;   // não pula a tela com a tecla que ainda estava apertada

        if (keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space) || keyboard_check_pressed(ord('E')))
        {
            // Game over: a sala reinicia como antes. Zerou: começa tudo de novo do mundo 1.
            if (this.kind === 'win') location.reload();
            else room_restart();
        }
    }

    draw() {}

    draw_gui()
    {
        const fade = clamp(this.timer / 40, 0, 1);
        const win = (this.kind === 'win');
        const cx = GUI_W / 2;

        draw_set_alpha(fade * (win ? 0.92 : 0.85));
        draw_set_colour(win ? make_colour_rgb(8, 20, 16) : make_colour_rgb(24, 4, 8));
        draw_rectangle(0, 0, GUI_W, GUI_H, false);
        draw_set_alpha(fade);

        draw_set_halign(fa_center);
        draw_set_valign(fa_middle);

        if (win)
        {
            ui_draw_text_shadow(cx, 120, 'REDE PROTEGIDA', c_lime, 4);
            ui_draw_text_shadow(cx, 190, 'O Cavalo de Troia foi encerrado e o data center está seguro.', c_white, 1.2);
            ui_draw_text_shadow(cx, 250, 'O que você levou desta jornada:', c_yellow, 1.2);

            const recap = end_screen_recap();
            for (let i = 0; i < recap.length; i++) ui_draw_text_shadow(cx, 300 + i * 40, recap[i], c_ltgray, 1);
        }
        else
        {
            ui_draw_text_shadow(cx, 260, 'SISTEMA COMPROMETIDO', c_red, 4);
            ui_draw_text_shadow(cx, 340, 'O antivírus caiu. A sala vai reiniciar.', c_white, 1.2);
            ui_draw_text_shadow(cx, 390, 'Dica: Esquivar faz o inimigo atacar com desvantagem, e a fogueira (R) recupera PV.', c_ltgray, 1);
        }

        if (this.timer >= 60 && Math.floor(this.timer / 30) % 2 === 0)
        {
            ui_draw_text_shadow(cx, GUI_H - 90, win ? 'Enter para jogar de novo' : 'Enter para tentar de novo', c_white, 1.2);
        }

        draw_set_alpha(1);
        draw_set_halign(fa_left);
        draw_set_valign(fa_top);
    }
}
