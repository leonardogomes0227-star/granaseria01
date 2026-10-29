import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O servidor roda em Node ESM ("type": "module"): import relativo precisa terminar em ".js" (ou ".json").
// tsc, Vite e Vitest aceitam sem extensão, então só o Vercel mostra o erro (ERR_MODULE_NOT_FOUND) e a função
// inteira deixa de carregar. Este teste segue tudo que api/*.ts alcança e falha se algum import estiver sem extensão.
// (Imports só de tipo, `import type`, são apagados na compilação e não contam.)

const RAIZ = resolve(__dirname, '..');
const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

function alvo(de: string, espec: string): string | null {
  const base = resolve(dirname(de), espec.replace(/\.js$/, ''));
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
}

function alcancados(): { arquivo: string; espec: string }[] {
  const fila = readdirSync(join(RAIZ, 'api'), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(RAIZ, 'api', f));
  const visto = new Set<string>();
  const ruins: { arquivo: string; espec: string }[] = [];
  while (fila.length) {
    const arq = fila.pop()!;
    if (visto.has(arq)) continue;
    visto.add(arq);
    const codigo = readFileSync(arq, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/(?:import|export)\s+type\s[^;]*?from\s*['"][^'"]+['"]/g, ''); // só tipo: some na compilação, não existe em Node
    for (const m of codigo.matchAll(IMPORT)) {
      const espec = m[1] ?? m[2] ?? m[3];
      if (!espec || !espec.startsWith('.')) continue; // pacote (node:, @supabase/…): fora
      if (!/\.(js|json)$/.test(espec)) ruins.push({ arquivo: relative(RAIZ, arq), espec });
      const prox = alvo(arq, espec);
      if (prox) fila.push(prox);
    }
  }
  return ruins;
}

describe('imports do servidor (Node ESM)', () => {
  it('todo import relativo alcançado por api/*.ts termina em .js', () => {
    expect(alcancados()).toEqual([]);
  });
});
