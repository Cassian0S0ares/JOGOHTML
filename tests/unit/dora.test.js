import { describe, expect, it } from 'vitest';
import { calcular } from '../../scripts/dora.mjs';

describe('métricas DORA', () =>
{
    const agora = '2026-10-15T00:00:00Z';

    it('calcula frequência, lead time, taxa de falha e recuperação', () =>
    {
        const m = calcular({
            agora,
            deploys: [
                { commit: '2026-10-01T00:00:00Z', fim: '2026-10-01T02:00:00Z', sucesso: true },
                { commit: '2026-10-08T00:00:00Z', fim: '2026-10-08T04:00:00Z', sucesso: true },
                { commit: '2026-10-09T00:00:00Z', fim: '2026-10-09T01:00:00Z', sucesso: false },
            ],
            rollbacks: 1,
            alertas: [
                { aberto: '2026-10-10T00:00:00Z', fechado: '2026-10-10T00:10:00Z' },
                { aberto: '2026-10-11T00:00:00Z', fechado: '2026-10-11T00:30:00Z' },
                { aberto: '2026-10-12T00:00:00Z', fechado: null },
            ],
        });

        expect(m.deploys_producao).toBe(2);
        expect(m.frequencia_por_semana).toBe(1);          // 2 deploys em 2 semanas
        expect(m.lead_time_horas).toBe(3);                // mediana de 2 h e 4 h
        expect(m.taxa_falha_percentual).toBe(50);         // 1 deploy falho + 1 rollback em 4
        expect(m.tempo_recuperacao_minutos).toBe(20);     // a Issue aberta não conta
        expect(m.alertas_fechados).toBe(2);
    });

    it('sem dados não divide por zero', () =>
    {
        const m = calcular({ agora, deploys: [], rollbacks: 0, alertas: [] });
        expect(m).toMatchObject({ deploys_producao: 0, frequencia_por_semana: 0, lead_time_horas: null, taxa_falha_percentual: null, tempo_recuperacao_minutos: null });
    });
});
