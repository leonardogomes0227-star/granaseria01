// Telefone (WhatsApp) no padrão brasileiro. Na tela aparece com máscara "(67) 99999-9999";
// no banco vai só com dígitos, com o código do país: "5567999999999". É esse número que o
// assistente do WhatsApp usa pra saber de quem é cada mensagem.

/** Até 11 dígitos nacionais (DDD + número), ignorando um "+55"/"55" colado na frente. */
export function nationalDigits(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

export function maskPhone(input: string): string {
  const d = nationalDigits(input);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Celular válido: DDD (11–99) + 9 dígitos começando com 9. */
export function isValidPhone(input: string): boolean {
  const d = nationalDigits(input);
  return /^[1-9][1-9]9\d{8}$/.test(d);
}

/** Formato salvo no banco: 55 + DDD + número. */
export function toE164Digits(input: string): string {
  return `55${nationalDigits(input)}`;
}
