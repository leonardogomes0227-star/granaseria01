// Mensagem de erro para log: tira e-mail, telefone e qualquer coisa com cara de chave.

export function resumoErro(err: unknown): string {
  const s = err instanceof Error ? err.message : String(err);
  return s
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b\d{10,15}\b/g, '[fone]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[jwt]')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, '[chave]')
    .slice(0, 300);
}

let ultimoAlerta = 0;

/** Um aviso por minuto, sem dado pessoal. Serve para o log da Vercel (o dono pode ligar um alerta em cima disso). */
export function alertaUso(tipo: string): void {
  const agora = Date.now();
  if (agora - ultimoAlerta < 60_000) return;
  ultimoAlerta = agora;
  console.warn('alerta-uso', tipo);
}
