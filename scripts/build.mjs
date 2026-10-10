// Build reprodutível: copia o jogo para dist/ e grava a versão (SemVer + SHA do commit).
// Dois builds do mesmo commit só diferem no campo "build" do version.json.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const sha = (process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString()).trim().slice(0, 7);
const versao = pkg.version;

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const item of ['index.html', 'style.css', 'js', 'assets']) cpSync(item, `dist/${item}`, { recursive: true });

writeFileSync('dist/js/version.js', `'use strict';\nconst GAME_VERSION = ${JSON.stringify({ versao, sha })};\n`);
writeFileSync('dist/version.json', JSON.stringify({ versao, sha, build: new Date().toISOString() }, null, 2) + '\n');
writeFileSync('dist/LEIA-ME.txt', `Projeto Tuba v${versao} (${sha})

Como jogar offline:
  1. Descompacte o build.zip.
  2. Abra o arquivo index.html no navegador (Chrome, Firefox ou Edge).
     Se o navegador bloquear arquivos locais, rode "npx serve" nesta pasta e abra o endereço mostrado.

Controles: WASD/Setas para andar, E para interagir, R para descanso longo, 7 liga o modo paz (testes).
`);

console.log(`dist/ gerado: v${versao} (${sha})`);
