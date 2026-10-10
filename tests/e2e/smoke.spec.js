/* global game, instance_exists, instance_create, instance_number, instance_find, room_goto, Combat, Portal, TrojanBoss */
import { expect, test } from '@playwright/test';

// Smoke: o jogo abre, carrega os sprites, desenha a sala e mostra a versão.
// EXPECTED_SHA (opcional) confere se a URL serve o commit que acabou de ser publicado.
test('o jogo abre e mostra a versão', async ({ page }) =>
{
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('./');
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('#versao')).toHaveText(/^v\d+\.\d+\.\d+ · [0-9a-f]{7}$/);
    if (process.env.EXPECTED_SHA) await expect(page.locator('#versao')).toContainText(process.env.EXPECTED_SHA);

    // A sala foi desenhada: o canvas tem pixels que não são pretos
    const pintado = await page.locator('#game').evaluate((c) =>
    {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 0) return true;
        return false;
    });
    expect(pintado).toBe(true);
    expect(erros).toEqual([]);
});

test('o jogador anda pela sala', async ({ page }) =>
{
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('./');
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });
    await page.locator('#game').click();

    const antes = await page.evaluate(() => ({ x: game.player.x, y: game.player.y }));
    await page.keyboard.down('s');
    await page.waitForTimeout(500);
    await page.keyboard.up('s');
    const depois = await page.evaluate(() => ({ x: game.player.x, y: game.player.y }));

    expect(depois.y).toBeGreaterThan(antes.y);
    expect(erros).toEqual([]);
});

test('o computador abre o quiz e o Esc fecha', async ({ page }) =>
{
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('./');
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });
    await page.locator('#game').click();

    // Modo paz para nenhum vírus começar luta no caminho; o antivírus vai para perto do computador de cima à esquerda
    await page.evaluate(() => { global.peace_mode = true; game.player.x = 240; game.player.y = 200; });
    await page.keyboard.press('e');
    await expect.poll(() => page.evaluate(() => instance_exists('obj_quiz'))).toBe(true);

    // O terminal ignora as teclas dos primeiros quadros (a mesma tecla que o abriu)
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => instance_exists('obj_quiz'))).toBe(false);
    expect(erros).toEqual([]);
});

test('o portal leva para a Room2 com o Firewall', async ({ page }) =>
{
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('./');
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });

    await page.evaluate(() =>
    {
        global.boss_ddos_defeated = true;
        instance_create(Portal, 688, 560).enter();
    });
    await expect.poll(() => page.evaluate(() => game.room), { timeout: 5_000 }).toBe('Room2');
    expect(await page.evaluate(() => [instance_exists('obj_firewall'), instance_number('obj_computer'), instance_number('obj_virus_elite')])).toEqual([true, 3, 5]);
    expect(erros).toEqual([]);
});

test('perder o combate mostra o game over e a sala reinicia', async ({ page }) =>
{
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('./');
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });
    await page.locator('#game').click();

    // Combate contra um vírus em que o golpe seguinte derruba o antivírus
    await page.evaluate(() => instance_create(Combat, 0, 0, { hero: game.player, foe: instance_find('obj_slime') }).damage_hero(999));
    // O combate mostra "Você caiu" e fecha com uma tecla; aí vem o game over
    await expect.poll(async () =>
    {
        const em_combate = await page.evaluate(() => instance_exists('obj_combat'));
        if (em_combate) await page.keyboard.press('Enter');
        return em_combate;
    }, { timeout: 10_000 }).toBe(false);
    expect(await page.evaluate(() => instance_exists('obj_end_screen'))).toBe(true);

    // A tela ignora teclas no primeiro segundo; depois o Enter reinicia a sala
    await page.waitForTimeout(1200);
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => instance_exists('obj_end_screen'))).toBe(false);
    expect(await page.evaluate(() => game.player.hp > 0)).toBe(true);
    expect(erros).toEqual([]);
});

test('vencer o Cavalo de Troia mostra a tela de fim de jogo', async ({ page }) =>
{
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('./');
    await expect(page.locator('#loading')).toHaveCount(0, { timeout: 15_000 });
    await page.locator('#game').click();

    await page.evaluate(() => { global.boss_ddos_defeated = true; room_goto('Room2'); });
    await expect.poll(() => page.evaluate(() => game.room)).toBe('Room2');

    // Cavalo derrotado: a última aulinha abre; pular as falas até a tela de fim
    await page.evaluate(() => { global.peace_mode = true; instance_create(TrojanBoss, 720, 360).is_dying = true; });
    await expect.poll(async () =>
    {
        await page.keyboard.press('Enter');
        return page.evaluate(() => instance_exists('obj_end_screen'));
    }, { timeout: 30_000 }).toBe(true);
    expect(await page.evaluate(() => instance_find('obj_end_screen').kind)).toBe('win');
    expect(erros).toEqual([]);
});
