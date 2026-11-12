// Criptografia em repouso, desligada por padrão.
//
// Liga só com ENCRYPTION_AT_REST=true e FIELD_ENCRYPTION_KEY (32 bytes em base64) na Vercel.
// A chave fica no servidor. Ela não entra no JavaScript do site.
//
// O que isto cobre, e só quando a flag está ligada: o texto da descrição de gastos e entradas,
// o estado do perfil do WhatsApp (wa_profiles) e os dados da conversa em andamento (wa_sessions
// do bot e o código "continuar no WhatsApp"). O que já está gravado sem o prefixo "enc:v1:"
// continua sendo lido como está. Na próxima gravação, com a flag ligada, passa a ir cifrado.
//
// O que isto NÃO cifra, de propósito:
// - user_state.state: o navegador lê e grava essa coluna direto (src/sync.ts). Cifrar aqui
//   quebraria a conta de quem já tem dados. Antes disso, a sincronização tem que passar pelo
//   servidor. Não está feito neste PR.
// - valor, telefone e categoria: o servidor filtra e soma por eles. Cifrar o valor exigiria
//   outra coluna e uma migração à parte.
// - localStorage (grana-seria:v1 e as outras chaves): a chave não pode ir pro navegador.
//
// Se o dado já está cifrado e a chave sumiu, a leitura falha com ErroCripto. Quem chama não
// pode tratar isso como "estado vazio" e gravar por cima: apagaria o dado.

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const PREFIXO = 'enc:v1:';
export const MARCA = '_gs_enc';

export class ErroCripto extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroCripto';
  }
}

type Env = Record<string, string | undefined>;

export function criptografiaLigada(env: Env = process.env): boolean {
  return env.ENCRYPTION_AT_REST?.trim().toLowerCase() === 'true';
}

function chave(env: Env): Buffer {
  const bruto = env.FIELD_ENCRYPTION_KEY?.trim() ?? '';
  let buf: Buffer;
  try {
    buf = Buffer.from(bruto, 'base64');
  } catch {
    throw new ErroCripto('FIELD_ENCRYPTION_KEY não é base64.');
  }
  if (buf.length !== 32) throw new ErroCripto('FIELD_ENCRYPTION_KEY precisa ter 32 bytes em base64.');
  return buf;
}

export function selarTexto(valor: string, env: Env = process.env): string {
  if (!criptografiaLigada(env)) return valor;
  if (valor.startsWith(PREFIXO)) return valor;
  const key = chave(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIXO + Buffer.concat([iv, tag, cifrado]).toString('base64');
}

/** Texto antigo (sem prefixo) volta igual. Texto cifrado só abre com a chave. Sem a chave, falha. */
export function abrirTexto(valor: string | null | undefined, env: Env = process.env): string {
  if (valor == null) return '';
  if (!valor.startsWith(PREFIXO)) return valor;
  const key = chave(env);
  const raw = Buffer.from(valor.slice(PREFIXO.length), 'base64');
  if (raw.length < 12 + 16) throw new ErroCripto('Dado cifrado incompleto.');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new ErroCripto('Não consegui abrir o dado cifrado. A chave pode ter mudado. Não grave por cima.');
  }
}

function pacote(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 1 && typeof obj[MARCA] === 'string';
}

/** Com a flag desligada, devolve o mesmo valor. Com a flag ligada, um pacote { _gs_enc }. */
export function selarJson<T>(valor: T, env: Env = process.env): T {
  if (!criptografiaLigada(env)) return valor;
  return { [MARCA]: selarTexto(JSON.stringify(valor), env) } as T;
}

/** Pacote cifrado abre pro valor original. Qualquer outra coisa (o JSON de hoje) volta igual. */
export function revelarJson<T>(raw: T, env: Env = process.env): T {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  if (!pacote(obj)) return raw;
  const texto = abrirTexto(obj[MARCA] as string, env);
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ErroCripto('Dado cifrado inválido. Não grave por cima.');
  }
}
