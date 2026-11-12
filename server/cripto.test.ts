import { describe, expect, it } from 'vitest';
import { abrirTexto, criptografiaLigada, ErroCripto, revelarJson, selarJson, selarTexto } from './cripto';

const chave = Buffer.alloc(32, 7).toString('base64');
const ligado = { ENCRYPTION_AT_REST: 'true', FIELD_ENCRYPTION_KEY: chave };
const desligado = {};

describe('criptografia em repouso', () => {
  it('fica desligada sem a flag', () => {
    expect(criptografiaLigada(desligado)).toBe(false);
    expect(criptografiaLigada({ ENCRYPTION_AT_REST: 'false' })).toBe(false);
  });

  it('com a flag desligada não muda texto nem estado', () => {
    const estado = { 'grana-seria:v1': '{"renda":1000}' };
    expect(selarTexto('mercado 35', desligado)).toBe('mercado 35');
    expect(selarJson(estado, desligado)).toBe(estado);
    expect(revelarJson(estado, desligado)).toBe(estado);
  });

  it('abre o texto antigo mesmo com a flag ligada', () => {
    expect(abrirTexto('mercado 35', ligado)).toBe('mercado 35');
    expect(revelarJson({ 'gs-nome': 'Ana' }, ligado)).toEqual({ 'gs-nome': 'Ana' });
  });

  it('cifra e abre de volta, e cada gravação sai diferente', () => {
    const a = selarTexto('aluguel', ligado);
    const b = selarTexto('aluguel', ligado);
    expect(a.startsWith('enc:v1:')).toBe(true);
    expect(a).not.toBe(b);
    expect(abrirTexto(a, ligado)).toBe('aluguel');
    const pacote = selarJson({ 'grana-seria:v1': '{"x":1}' }, ligado);
    expect(revelarJson(pacote, ligado)).toEqual({ 'grana-seria:v1': '{"x":1}' });
  });

  it('não cifra duas vezes', () => {
    const uma = selarTexto('pix', ligado);
    expect(selarTexto(uma, ligado)).toBe(uma);
  });

  it('sem a chave, recusa abrir em vez de devolver vazio', () => {
    const cifrado = selarTexto('segredo', ligado);
    expect(() => abrirTexto(cifrado, { ENCRYPTION_AT_REST: 'true' })).toThrow(ErroCripto);
    expect(() => selarTexto('x', { ENCRYPTION_AT_REST: 'true' })).toThrow(ErroCripto);
  });
});
