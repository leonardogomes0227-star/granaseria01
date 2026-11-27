// Valor de filtro do PostgREST. Vírgula, parêntese e aspas não podem virar outro filtro
// (isso seria um atalho para ler a linha de outra pessoa).

const SEGURO = /^[A-Za-z0-9_.:@+-]+$/;

export function valorFiltro(valor: string): string {
  if (SEGURO.test(valor) && !valor.includes('..')) return valor;
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/** E-mail que pode entrar num filtro. O que tiver vírgula, espaço ou outro caractere estranho é recusado. */
export function emailSeguro(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e.length > 120 || !EMAIL.test(e)) return null;
  return e;
}
