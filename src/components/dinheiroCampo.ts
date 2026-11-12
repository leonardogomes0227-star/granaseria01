function formatNumber(value: number, decimals: number): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals > 0 && value % 1 !== 0 ? decimals : 0,
    maximumFractionDigits: decimals,
  });
}

/**
 * O que a pessoa digitou vira número no padrão brasileiro.
 * O ponto sozinho (ou "12.5") é centavo: no celular o teclado decimal manda ".", e ele sumia antes do próximo dígito.
 * "1.500" colado continua milhar. "1.500,50" também.
 */
export function digitarDinheiro(raw: string, decimals = 2, max = 99_999_999): { texto: string; valor: number } {
  let s = raw;
  if (decimals > 0 && !s.includes(',')) {
    if (/\.\d{1,2}$/.test(s) && !/\.\d{3}/.test(s)) s = s.replace(/\.(\d{1,2})$/, ',$1');
    else if (/\.$/.test(s) && !/\.\d{3}/.test(s)) s = `${s.slice(0, -1)},`;
  }
  s = s.replace(/[^\d,]/g, '');
  const hasComma = decimals > 0 && s.includes(',');
  const [intRaw, ...decParts] = s.split(',');
  const dec = decParts.join('').slice(0, decimals);
  const intDigits = intRaw.replace(/^0+(?=\d)/, '').slice(0, 9);
  let num = parseFloat(`${intDigits || '0'}.${dec || '0'}`);
  if (!Number.isFinite(num)) num = 0;
  const estourou = num > max;
  if (estourou) num = max;
  const intFmt = intDigits ? Number(intDigits).toLocaleString('pt-BR') : hasComma ? '0' : '';
  const texto = estourou ? formatNumber(max, decimals) : intFmt + (hasComma ? `,${dec}` : '');
  return { texto, valor: num };
}
