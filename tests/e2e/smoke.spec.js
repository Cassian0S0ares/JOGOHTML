/* global game */
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
