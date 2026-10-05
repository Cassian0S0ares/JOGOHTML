// Carrega scripts clássicos do jogo (js/*.js) num contexto isolado e devolve os nomes pedidos.
// Os scripts compartilham o escopo global, como no navegador.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function carregar(arquivos, nomes, extras = {})
{
    const contexto = vm.createContext({ Math, ...extras });
    for (const arquivo of arquivos) vm.runInContext(readFileSync(arquivo, 'utf8'), contexto, { filename: arquivo });
    return vm.runInContext(`({ ${nomes.join(', ')} })`, contexto);
}
