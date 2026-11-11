import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// O plano da Vercel aceita no máximo 12 funções (cada arquivo .ts em api/ é uma). Passar disso derruba o deploy inteiro.
describe('funções da Vercel', () => {
  it('no máximo 12 arquivos em api/', () => {
    const api = resolve(__dirname, '..', 'api');
    const funcoes = readdirSync(api, { recursive: true }).map(String).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(funcoes.map((f) => join('api', f)).sort(), 'junte a função nova em uma que já existe').toHaveLength(12);
  });
});
