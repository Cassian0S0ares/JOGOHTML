// docs/gdd.md → docs/GDD.pdf, com versão, data e commit do build (Markdown → HTML → PDF pelo Chromium do Playwright)
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { marked } from 'marked';
import { chromium } from '@playwright/test';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const sha = (process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString()).trim().slice(0, 7);
const data = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

const markdown = readFileSync('docs/gdd.md', 'utf8')
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replaceAll('{{VERSAO}}', pkg.version)
    .replaceAll('{{DATA}}', data)
    .replaceAll('{{SHA}}', sha);

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Projeto Tuba · GDD v${pkg.version}</title>
<style>
  body { font: 11pt/1.5 "DejaVu Sans", Arial, sans-serif; color: #222; }
  h1 { font-size: 20pt; border-bottom: 2px solid #335; padding-bottom: 4px; }
  h2 { font-size: 14pt; color: #335; margin-top: 18pt; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; }
  th { background: #eef; }
  img { max-width: 100%; border: 1px solid #ccc; }
  pre { background: #f4f4f8; padding: 8px; font-size: 8.5pt; }
  blockquote { color: #555; border-left: 3px solid #99c; margin-left: 0; padding-left: 10px; }
</style></head><body>${marked.parse(markdown)}</body></html>`;

const temporario = resolve('docs/.gdd.html');
writeFileSync(temporario, html);
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto('file://' + temporario);
await pagina.pdf({ path: 'docs/GDD.pdf', format: 'A4', margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#888">Projeto Tuba · GDD v${pkg.version} · ${sha} · <span class="pageNumber"></span>/<span class="totalPages"></span></div>` });
await navegador.close();
rmSync(temporario);
console.log(`docs/GDD.pdf gerado: v${pkg.version} (${sha}, ${data})`);
