/** Só aceita caminhos internos no ?next= (evita redirecionar pra outro site). */
export function safeNext(next: string | null, fallback = '/diagnostico'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}

export function authLink(mode: 'entrar' | 'cadastro', next: string): string {
  return `/${mode}?next=${encodeURIComponent(next)}`;
}

