import { describe, expect, it } from 'vitest';
import { codigoVinculoAceito, entradaAindaVale, novoCodigoVinculo } from './linkEntrada';
import { parsePlanCommand } from './whatsapp/planbot';

describe('código de vínculo', () => {
  it('gera 10 caracteres do alfabeto sem ambiguidade', () => {
    const code = novoCodigoVinculo();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    expect(codigoVinculoAceito(code)).toBe(true);
  });

  it('ainda aceita o código antigo de 6 dígitos e recusa o resto', () => {
    expect(codigoVinculoAceito('123456')).toBe(true);
    expect(codigoVinculoAceito('12345')).toBe(false);
    expect(codigoVinculoAceito('1234567')).toBe(false);
    expect(codigoVinculoAceito('ABCDE01234')).toBe(false);
  });

  it('o bot entende o código antigo e o novo', () => {
    expect(parsePlanCommand('VINCULAR 123456')).toEqual({ kind: 'link', code: '123456' });
    expect(parsePlanCommand('vincular abcdefghjk')).toEqual({ kind: 'link', code: 'ABCDEFGHJK' });
    expect(parsePlanCommand('vincular 12345')).toBeNull();
    expect(parsePlanCommand('gastei 35 no mercado')).toBeNull();
  });
});

describe('link de entrada', () => {
  const agora = Date.parse('2026-11-12T15:00:00Z');
  it('vale 30 minutos e, depois do primeiro uso, só mais 2', () => {
    expect(entradaAindaVale(new Date(agora - 10 * 60 * 1000).toISOString(), null, agora)).toBe(true);
    expect(entradaAindaVale(new Date(agora - 31 * 60 * 1000).toISOString(), null, agora)).toBe(false);
    expect(entradaAindaVale(new Date(agora - 10 * 60 * 1000).toISOString(), new Date(agora - 60 * 1000).toISOString(), agora)).toBe(true);
    expect(entradaAindaVale(new Date(agora - 10 * 60 * 1000).toISOString(), new Date(agora - 3 * 60 * 1000).toISOString(), agora)).toBe(false);
  });
});
