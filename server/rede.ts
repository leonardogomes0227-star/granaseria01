// IP de quem chamou e um limite simples por instância da função.
// A Vercel coloca o IP real em x-real-ip. O primeiro valor de x-forwarded-for pode ter sido
// escrito por quem chamou, então ele não serve de chave de limite.

const baldes = new Map<string, { n: number; ate: number }>();

export function ipDoCliente(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 80);
  const partes = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (partes[partes.length - 1] || 'desconhecido').slice(0, 80);
}

function limpar(agora: number) {
  if (baldes.size < 5000) return;
  for (const [k, v] of baldes) if (agora > v.ate) baldes.delete(k);
  if (baldes.size > 5000) baldes.clear();
}

/** Já passou do limite nesta janela? Não conta esta chamada. */
export function excedeuLimite(chave: string, limite: number, janelaMs: number, agora = Date.now()): boolean {
  const b = baldes.get(chave);
  if (!b || agora > b.ate) return false;
  return b.n >= limite;
}

/** Conta uma chamada nesta janela. */
export function contarLimite(chave: string, janelaMs: number, agora = Date.now()): void {
  const b = baldes.get(chave);
  if (!b || agora > b.ate) {
    baldes.set(chave, { n: 1, ate: agora + janelaMs });
    limpar(agora);
    return;
  }
  b.n += 1;
}

/** Só nos testes: zera os contadores. */
export function zerarLimites(): void {
  baldes.clear();
}
