// Carrega scripts clássicos do jogo (js/*.js) num contexto isolado e devolve os nomes pedidos.
// Os scripts compartilham o escopo global, como no navegador.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// Cada arquivo é compilado uma vez, com a URL file:// dele, para a cobertura do v8 medir o js/ do jogo
const compilados = new Map();
const script = (arquivo) =>
{
    if (!compilados.has(arquivo))
    {
        compilados.set(arquivo, new vm.Script(readFileSync(arquivo, 'utf8'), { filename: pathToFileURL(resolve(arquivo)).href }));
    }
    return compilados.get(arquivo);
};

export function carregar(arquivos, nomes, extras = {})
{
    const contexto = vm.createContext({ Math, ...extras });
    for (const arquivo of arquivos) script(arquivo).runInContext(contexto);
    return vm.runInContext(`({ ${nomes.join(', ')} })`, contexto);
}
