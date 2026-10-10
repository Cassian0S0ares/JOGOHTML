import { defineConfig } from 'vitest/config';

// Núcleo do jogo: as regras puras (D&D e minijogos), separadas do desenho. É o que a meta de cobertura mede.
const nucleo = ['js/scr_dnd.js', 'js/scr_quiz.js', 'js/scr_inbox.js', 'js/scr_patch.js', 'js/scr_netfilter.js', 'js/scr_rhythm.js'];

export default defineConfig({
    test: {
        include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
        coverage: {
            provider: 'v8',
            include: nucleo,
            reporter: ['text', 'cobertura', 'html'],
            reportsDirectory: 'reports/coverage',
            thresholds: { lines: 70, statements: 70 },   // abaixo disso o test:ci falha e o PR não entra
        },
    },
});
