/**
 * Enquanto digita, não sobe o número até o mínimo: "1" é o começo de "10", e "0," é o começo de "0,5".
 * O teto vale na hora. `null` = texto ainda não é um número (não atualiza o valor).
 */
export function digitarNumero(bruto: string, max?: number): { texto: string; valor: number | '' | null } {
  const t = bruto.replace(/[^\d,.]/g, '');
  if (t === '' || t === ',' || t === '.') return { texto: t, valor: '' };
  const n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return { texto: t, valor: null };
  if (max !== undefined && n > max) return { texto: String(max).replace('.', ','), valor: max };
  return { texto: t, valor: n };
}

/** Ao sair do campo, o mínimo passa a valer. Texto vazio ou quebrado vira vazio. */
export function fecharNumero(bruto: string, min?: number, max?: number): { texto: string; valor: number | '' } {
  const t = bruto.trim();
  if (t === '' || t === ',' || t === '.') return { texto: '', valor: '' };
  let n = Number(t.replace(',', '.'));
  if (!Number.isFinite(n)) return { texto: '', valor: '' };
  if (max !== undefined && n > max) n = max;
  if (min !== undefined && n < min) n = min;
  return { texto: String(n).replace('.', ','), valor: n };
}
