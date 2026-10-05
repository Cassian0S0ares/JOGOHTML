import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/', 'dist/', 'coverage/', 'reports/', 'playwright-report/', 'test-results/', 'js/data.js'] },
    js.configs.recommended,
    {
        // O jogo roda como scripts clássicos que compartilham o escopo global (estilo GML),
        // então variáveis de um arquivo são usadas em outro: no-undef/no-unused-vars não se aplicam.
        files: ['js/**/*.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
        rules: { 'no-undef': 'off', 'no-unused-vars': 'off', 'no-redeclare': 'off' },
    },
    {
        files: ['scripts/**/*.mjs', 'tests/**/*.js', '*.config.js'],
        languageOptions: { sourceType: 'module', globals: { ...globals.node } },
    },
    {
        files: ['pages/**/*.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
    },
];
