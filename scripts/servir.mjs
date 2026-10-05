// Servidor estático mínimo para rodar o E2E local contra dist/ (node scripts/servir.mjs [pasta] [porta])
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const raiz = process.argv[2] || 'dist';
const porta = Number(process.argv[3] || 4173);
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.ogg': 'audio/ogg', '.txt': 'text/plain' };

createServer(async (req, res) =>
{
    let caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (caminho.endsWith('/')) caminho += 'index.html';
    try
    {
        const corpo = await readFile(join(raiz, caminho));
        res.writeHead(200, { 'Content-Type': tipos[extname(caminho)] || 'application/octet-stream' });
        res.end(corpo);
    }
    catch
    {
        res.writeHead(404).end('não encontrado');
    }
}).listen(porta, () => console.log(`servindo ${raiz} em http://localhost:${porta}/`));
