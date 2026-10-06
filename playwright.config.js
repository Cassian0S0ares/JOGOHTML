import { defineConfig, devices } from '@playwright/test';

// Sem BASE_URL, testa o dist/ local; na pipeline, BASE_URL aponta para homologação ou produção.
const local = !process.env.BASE_URL;

export default defineConfig({
    testDir: 'tests/e2e',
    timeout: 30_000,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['junit', { outputFile: 'reports/e2e-junit.xml' }], ['html', { outputFolder: 'reports/playwright', open: 'never' }]],
    use: {
        baseURL: process.env.BASE_URL || 'http://localhost:4173/',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: local ? { command: 'node scripts/servir.mjs dist 4173', url: 'http://localhost:4173/', reuseExistingServer: true } : undefined,
});
