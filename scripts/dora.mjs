// Métricas DORA a partir da API do GitHub (INT-08). Escreve o JSON em stdout:
//   GITHUB_TOKEN=... GITHUB_REPOSITORY=dono/repo node scripts/dora.mjs > status/dora.json
// - Frequência de deploy: execuções do job deploy-prd que terminaram com sucesso, por semana.
// - Lead time: do commit até o fim do deploy-prd (mediana).
// - Taxa de falha: deploy-prd que falhou (o smoke derrubou e houve rollback automático) ou rollback manual.
// - Tempo de recuperação: abertura até fechamento das Issues "alerta" (mediana).

const HORA = 3_600_000;
export const LINHA_DE_BASE_LEAD_TIME_HORAS = 11 * 24;   // Carparts: 11 dias

const mediana = (v) =>
{
    if (v.length === 0) return null;
    const o = [...v].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const arred = (n, casas = 1) => (n === null ? null : Number(n.toFixed(casas)));

/// deploys: [{ commit, fim, sucesso }] (datas ISO); rollbacks: nº de rollbacks manuais; alertas: [{ aberto, fechado }]
export function calcular({ deploys, rollbacks, alertas, agora = new Date().toISOString() })
{
    const ok = deploys.filter((d) => d.sucesso);
    const falhas = deploys.length - ok.length + rollbacks;
    const inicio = deploys.length ? Math.min(...deploys.map((d) => Date.parse(d.commit))) : Date.parse(agora);
    const semanas = Math.max(1, (Date.parse(agora) - inicio) / (7 * 24 * HORA));
    const lead = mediana(ok.map((d) => (Date.parse(d.fim) - Date.parse(d.commit)) / HORA));
    const recup = mediana(alertas.filter((a) => a.fechado).map((a) => (Date.parse(a.fechado) - Date.parse(a.aberto)) / 60_000));

    return {
        gerado: agora,
        deploys_producao: ok.length,
        frequencia_por_semana: arred(ok.length / semanas),
        lead_time_horas: arred(lead),
        lead_time_linha_de_base_horas: LINHA_DE_BASE_LEAD_TIME_HORAS,
        taxa_falha_percentual: deploys.length + rollbacks ? arred(100 * falhas / (deploys.length + rollbacks)) : null,
        tempo_recuperacao_minutos: arred(recup),
        alertas_fechados: alertas.filter((a) => a.fechado).length,
    };
}

async function api(caminho)
{
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${caminho}`, {
        headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }) },
    });
    if (!r.ok) throw new Error(`${caminho}: HTTP ${r.status}`);
    return r.json();
}

async function coletar()
{
    const { workflow_runs: runs } = await api('actions/workflows/esteira.yml/runs?branch=main&event=push&per_page=50');
    const deploys = [];
    for (const run of runs)
    {
        const { jobs } = await api(`actions/runs/${run.id}/jobs`);
        const job = jobs.find((j) => j.name === 'deploy-prd');
        // Só conta deploy que rodou de verdade (não o que ficou esperando aprovação ou foi pulado)
        if (!job || !['success', 'failure'].includes(job.conclusion)) continue;
        deploys.push({ commit: run.head_commit.timestamp, fim: job.completed_at, sucesso: job.conclusion === 'success' });
    }

    const { workflow_runs: rb } = await api('actions/workflows/rollback.yml/runs?status=success&per_page=100');
    const issues = await api('issues?labels=alerta&state=all&per_page=100');
    const alertas = issues.map((i) => ({ aberto: i.created_at, fechado: i.closed_at }));

    return { deploys, rollbacks: rb.length, alertas };
}

if (process.argv[1]?.endsWith('dora.mjs'))   // rodado direto (não importado pelos testes)
{
    console.log(JSON.stringify(calcular(await coletar()), null, 2));
}
