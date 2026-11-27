// Autorização e identidade do aviso da Cakto.
// Se vier o cabeçalho de assinatura, ele precisa bater com o HMAC do corpo cru.
// Sem esse cabeçalho, continua valendo o segredo compartilhado (o jeito que a Cakto manda hoje).

import { createHash, createHmac } from 'node:crypto';
import { mesmoSegredo } from '../segredo.js';

export function hmacConfere(raw: string, header: string, segredo: string): boolean {
  const got = header.trim().replace(/^sha256=/i, '');
  if (!/^[a-f0-9]{64}$/i.test(got)) return false;
  const mac = createHmac('sha256', segredo).update(raw).digest('hex');
  return mesmoSegredo(got.toLowerCase(), mac);
}

/** true só quando o aviso é da Cakto. Assinatura presente e errada não cai no segredo do corpo. */
export function caktoAutorizado(raw: string, enviado: string, assinatura: string | null, segredo: string | undefined): boolean {
  if (!segredo) return false;
  if (assinatura) return hmacConfere(raw, assinatura, segredo);
  return mesmoSegredo(enviado, segredo);
}

/** O mesmo corpo, duas vezes, vira o mesmo id. Um corpo diferente (mesmo que o segredo bata) é outro evento. */
export function idDoEvento(raw: string, evento: string, ref: string | null): string {
  const corpo = createHash('sha256').update(raw).digest('hex').slice(0, 32);
  const nome = (evento || 'evt').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'evt';
  const codigo = (ref || 'sem-ref').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'sem-ref';
  return `${nome}:${codigo}:${corpo}`.slice(0, 120);
}

export function eventoRepetido(status: number, corpo: string): boolean {
  return status === 409 || /23505|duplicate key/i.test(corpo);
}

export function tabelaDeEventoAusente(status: number, corpo: string): boolean {
  return status === 404 || /42P01|does not exist|schema cache|Could not find the table/i.test(corpo);
}
