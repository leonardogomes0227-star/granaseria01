// Código que liga o WhatsApp à conta, e a validade do link de entrada do painel.
// O código antigo (6 dígitos, gerado no navegador) continua valendo até expirar.
// O código novo tem 10 caracteres, sem 0/O/1/I, e só o servidor o grava.

import { randomInt } from 'node:crypto';

export const ALFABETO_VINCULO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ENTRADA_TTL_MS = 30 * 60 * 1000;
const ENTRADA_POS_USO_MS = 2 * 60 * 1000;

export function novoCodigoVinculo(): string {
  return Array.from({ length: 10 }, () => ALFABETO_VINCULO[randomInt(ALFABETO_VINCULO.length)]).join('');
}

/** 6 dígitos (links já emitidos) ou 10 caracteres do alfabeto novo. */
export function codigoVinculoAceito(code: string): boolean {
  return /^\d{6}$/.test(code) || new RegExp(`^[${ALFABETO_VINCULO}]{10}$`).test(code);
}

/**
 * Link de entrada (?t= na mensagem do WhatsApp). Vale 30 minutos.
 * Depois do primeiro uso, vale mais 2 minutos (a página abre várias chamadas juntas) e morre.
 * O token que fica no navegador é outro, de longa duração, e não volta pra URL.
 */
export function entradaAindaVale(criadoEm: string, usadoEm: string | null | undefined, agora = Date.now()): boolean {
  const idade = agora - new Date(criadoEm).getTime();
  if (!Number.isFinite(idade) || idade < 0 || idade > ENTRADA_TTL_MS) return false;
  if (!usadoEm) return true;
  const desdeUso = agora - new Date(usadoEm).getTime();
  return Number.isFinite(desdeUso) && desdeUso >= 0 && desdeUso <= ENTRADA_POS_USO_MS;
}
