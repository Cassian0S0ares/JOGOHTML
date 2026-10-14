'use strict';
// Central de atualizações (obj_patch, Room2): conter o worm antes que ele chegue nos ativos críticos

class Patch extends Terminal
{
    static object = 'obj_patch';

    create()
    {
        super.create();

        // "computer" e "title" vêm de terminal_start()
        this.title ??= 'Central de Atualizações';

        this.network = patch_create_network();

        // Estados: "briefing" explicação, "choose" escolhendo a atualização, "spread" worm avançando, "result" placar final
        this.state = 'briefing';
        this.turn = 0;
        this.selected = 0;
        this.spread_timer = 0;
        this.last_message = '';
        this.won = false;
        this.anim_time = 0;
    }

    /// Retângulos em coordenadas da GUI: lista de atualizações à esquerda, mapa da rede à direita
    layout()
    {
        const result = terminal_layout(1080, 660);
        const list_width = 400;
        let y = result.body_y + 30;

        result.items = [];
        for (let i = 0; i < this.network.updates.length; i++)
        {
            result.items.push({ x1: result.text_x, y1: y, x2: result.text_x + list_width, y2: y + 30 });
            y += 34;
        }
        result.detail_y = y + 8;
        result.detail_width = list_width;

        result.map = {
            x1: result.text_x + list_width + 24, y1: result.body_y + 30,
            x2: result.x2 - result.padding, y2: result.body_y + 330,
        };
        result.message_y = result.map.y2 + 16;

        return result;
    }

    /// Posição de um aparelho na GUI
    node_position(layout, node)
    {
        const map = layout.map;
        const margin = 36;
        return {
            x: lerp(map.x1 + margin, map.x2 - margin, node.map_x),
            y: lerp(map.y1 + margin, map.y2 - margin - 20, node.map_y),
        };
    }

    install(index)
    {
        const update = this.network.updates[index];
        if (update.installed) return;

        this.turn += 1;
        patch_install(this.network, index);

        const infected = patch_spread(this.network);
        if (update.fixes.length === 0) this.last_message = '"' + update.name + '" instalado... e não corrigiu nada. O worm aproveitou o tempo.';
        else this.last_message = '"' + update.name + '" instalado.';
        if (infected > 0) this.last_message += ' O worm avançou e infectou ' + infected + (infected === 1 ? ' aparelho.' : ' aparelhos.');
        else this.last_message += ' O worm não conseguiu avançar.';

        this.state = 'spread';
        this.spread_timer = 0;
        this.idle_timer = 0;
    }

    /// Depois da animação: perdeu um ativo crítico, conteve o worm, ou segue o jogo
    finish_spread()
    {
        if (patch_critical_lost(this.network) > 0)
        {
            this.state = 'result';
            this.won = false;
        }
        else if (!patch_can_spread(this.network))
        {
            this.state = 'result';
            this.won = true;
            terminal_solve(this.computer);
        }
        else
        {
            this.state = 'choose';
            // Pula para uma atualização ainda não instalada
            if (this.network.updates[this.selected].installed) this.move_selection(1);
        }
        this.idle_timer = 0;
    }

    move_selection(direction)
    {
        const count = this.network.updates.length;
        for (let step = 0; step < count; step++)
        {
            this.selected = (this.selected + direction + count) % count;
            if (!this.network.updates[this.selected].installed) return;
        }
    }

    step()
    {
        this.idle_timer += 1;
        this.anim_time += 1;

        // Clarão vermelho dos aparelhos recém-infectados
        for (const node of this.network.nodes) node.flash = Math.max(0, node.flash - 1 / 40);

        if (this.input_delay > 0)
        {
            this.input_delay -= 1;
            return;
        }

        if (keyboard_check_pressed(vk_escape))
        {
            this.close();
            return;
        }

        const confirm = keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space) || keyboard_check_pressed(ord('E'));
        const click = mouse_check_button_pressed();

        switch (this.state)
        {
            case 'briefing':
                if (confirm || click)
                {
                    this.state = 'choose';
                    this.idle_timer = 0;
                }
                break;

            case 'choose':
            {
                const move = (keyboard_check_pressed(vk_down) || keyboard_check_pressed(ord('S')))
                    - (keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord('W')));
                if (move !== 0) this.move_selection(move);

                // Mouse: passar por cima destaca, clicar instala
                let hovered = -1;
                this.layout().items.forEach((rect, i) =>
                {
                    if (!this.network.updates[i].installed && terminal_mouse_in(rect)) hovered = i;
                });
                if (this.mouse_moved() && hovered !== -1) this.selected = hovered;

                if (click && hovered !== -1) this.install(hovered);
                else if (confirm) this.install(this.selected);
                break;
            }

            case 'spread':
                this.spread_timer += 1;
                if (this.spread_timer >= PATCH_SPREAD_FRAMES) this.finish_spread();
                break;

            case 'result':
                if (confirm || click) this.close();
                break;
        }
    }

    /// Lista de atualizações, mapa da rede com o worm e placar
    draw_gui()
    {
        const layout = this.layout();
        const network = this.network;
        terminal_draw_frame(layout, this.title, (this.state === 'result') ? 'Fim' : 'Atualizações instaladas: ' + this.turn);

        const line_height = layout.line_height;
        const text_x = layout.text_x;
        let hint = '';

        // Aparelhos que a atualização destacada corrige (piscam no mapa)
        const preview = (this.state === 'choose') ? network.updates[this.selected].fixes : [];

        // Mapa da rede
        const map = layout.map;
        draw_set_colour(make_colour_rgb(16, 15, 24));
        draw_rectangle(map.x1, map.y1, map.x2, map.y2, false);
        draw_set_colour(UI_BORDER);
        draw_rectangle(map.x1, map.y1, map.x2, map.y2, true);

        // Cabos
        for (const link of network.links)
        {
            const a = network.nodes[link[0]];
            const b = network.nodes[link[1]];
            const pa = this.node_position(layout, a);
            const pb = this.node_position(layout, b);
            const both = a.infected && b.infected;
            draw_set_colour(both ? make_colour_rgb(160, 40, 50) : make_colour_rgb(70, 66, 96));
            draw_line_width(pa.x, pa.y, pb.x, pb.y, both ? 3 : 2);
        }

        // Aparelhos
        draw_set_halign(fa_center);
        network.nodes.forEach((node, i) =>
        {
            const p = this.node_position(layout, node);
            const radius = 18;

            let fill = make_colour_rgb(48, 52, 80);
            let outline = make_colour_rgb(140, 140, 180);
            if (node.patched)
            {
                fill = make_colour_rgb(24, 90, 48);
                outline = c_lime;
            }
            if (node.infected)
            {
                const pulse = 0.5 + 0.5 * Math.sin(this.anim_time / 8 + i);
                fill = merge_colour(make_colour_rgb(110, 20, 30), make_colour_rgb(200, 40, 50), pulse);
                fill = merge_colour(fill, c_white, node.flash);
                outline = c_red;
            }

            // Anel amarelo: a atualização destacada corrige este aparelho
            if (preview.includes(i) && !node.patched && !node.infected)
            {
                draw_set_colour(c_yellow);
                draw_circle(p.x, p.y, radius + 6 + 2 * Math.sin(this.anim_time / 6), true);
            }
            if (node.critical)
            {
                draw_set_colour(make_colour_rgb(255, 200, 60));
                draw_circle(p.x, p.y, radius + 3, true);
            }

            draw_set_colour(fill);
            draw_circle(p.x, p.y, radius, false);
            draw_set_colour(outline);
            draw_circle(p.x, p.y, radius, true);

            draw_set_valign(fa_middle);
            draw_set_colour(c_white);
            const icon = node.infected ? '!' : (node.patched ? 'OK' : '');
            if (icon !== '') draw_text(p.x, p.y, icon);
            draw_set_valign(fa_top);

            draw_set_colour(node.critical ? make_colour_rgb(255, 200, 60) : c_ltgray);
            draw_text(p.x, p.y + radius + 4, node.name);
        });
        draw_set_halign(fa_left);

        // Legenda
        draw_set_colour(c_gray);
        draw_text(map.x1 + 8, map.y2 - line_height - 4, 'Anel dourado: ativo crítico   Vermelho: infectado   Verde: corrigido');

        // Coluna da esquerda: briefing, lista de atualizações ou resultado
        const detail_width = layout.detail_width;

        if (this.state === 'briefing')
        {
            draw_set_colour(c_red);
            draw_text(text_x, layout.body_y, 'ALERTA: WORM NA REDE!');
            draw_set_colour(c_white);
            draw_text_ext(text_x, layout.body_y + 34,
                'O estagiário espetou um pendrive achado no estacionamento e um worm entrou pelo notebook dele.\n\n'
                + 'A cada atualização que você instalar, o worm avança um passo pelos cabos, infectando os aparelhos vizinhos que ainda não foram corrigidos.\n\n'
                + 'Proteja os 3 ativos críticos (anel dourado). Olhe bem o mapa: o worm pode ter mais de um caminho, e cada instalação desperdiçada é um passo de graça para ele.',
                line_height, detail_width);
            hint = 'Enter, Espaço ou clique: começar >';
        }
        else if (this.state === 'result')
        {
            ui_draw_text_shadow(text_x, layout.body_y + 4, this.won ? 'WORM CONTIDO!' : 'ATIVO CRÍTICO PERDIDO!', this.won ? c_lime : c_red, 2);

            const infected = patch_infected_count(network);
            let message;
            if (this.won)
            {
                message = 'Os dados importantes estão a salvo. Aparelhos infectados: ' + infected + ' de ' + network.nodes.length + '.\n\n'
                    + 'Prioridade em atualização não é só a etiqueta CRÍTICA: é o que o ataque consegue alcançar primeiro. Uma câmera esquecida no Wi-Fi pode ser a porta dos fundos do servidor.';
            }
            else
            {
                message = 'O worm chegou num ativo crítico.\n\n'
                    + 'Dica: são dois caminhos até os dados, o roteador e a câmera Wi-Fi que grava no servidor. Feche os dois antes que o worm chegue, e não gaste instalação com o que não fecha porta nenhuma.\n\nTente de novo!';
            }
            draw_set_colour(c_white);
            draw_text_ext(text_x, layout.body_y + 64, message, line_height, detail_width);
            hint = 'Enter, Espaço ou clique: fechar';
        }
        else
        {
            draw_set_colour(c_gray);
            draw_text(text_x, layout.body_y, 'Atualizações pendentes:');

            network.updates.forEach((update, i) =>
            {
                const rect = layout.items[i];
                const highlight = (this.state === 'choose' && i === this.selected);

                draw_set_colour(highlight ? make_colour_rgb(48, 44, 80) : make_colour_rgb(32, 30, 46));
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, false);
                draw_set_colour(highlight ? c_yellow : UI_BORDER);
                draw_rectangle(rect.x1, rect.y1, rect.x2, rect.y2, true);

                draw_set_colour(update.installed ? c_dkgray : (highlight ? c_yellow : c_white));
                draw_text(rect.x1 + 10, rect.y1 + 4, update.name);

                draw_set_halign(fa_right);
                draw_set_colour(update.installed ? c_dkgray : patch_severity_colour(update.severity));
                draw_text(rect.x2 - 10, rect.y1 + 4, update.installed ? 'instalada' : patch_severity_label(update.severity));
                draw_set_halign(fa_left);
            });

            // Notas da atualização destacada
            if (this.state === 'choose')
            {
                draw_set_colour(c_ltgray);
                draw_text_ext(text_x, layout.detail_y, network.updates[this.selected].description, line_height, detail_width);
                hint = 'W/S: escolher   Enter ou clique: instalar   Esc: sair';
            }
        }

        // O que aconteceu na última instalação
        if (this.last_message !== '' && this.state !== 'briefing')
        {
            draw_set_colour(this.state === 'spread' ? c_yellow : c_ltgray);
            draw_text_ext(map.x1, layout.message_y, this.last_message, line_height, map.x2 - map.x1);
        }

        terminal_draw_hint(layout, hint, this.state === 'briefing' || this.state === 'result', this.idle_timer);
    }
}

OBJECTS.obj_patch = Patch;
