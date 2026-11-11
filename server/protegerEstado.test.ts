import { describe, expect, it } from 'vitest';
import { protegerEstado, BACKUPS } from './protegerEstado';
import { pesoDoEstado } from '../src/gs/pesoEstado';

const cheio = JSON.stringify({ config: { renda: 3000, onboardingFeito: true }, lancamentos: [{ id: 'a' }, { id: 'b' }], gastosFixos: [{ id: 'g' }] });
const vazio = JSON.stringify({ config: { renda: 0, onboardingFeito: false }, lancamentos: [], gastosFixos: [] });

describe('proteção do estado no servidor', () => {
  it('conta só o que a pessoa criou', () => {
    expect(pesoDoEstado(vazio)).toBe(0);
    expect(pesoDoEstado(cheio)).toBe(5);
    expect(pesoDoEstado('{quebrado')).toBe(0);
    expect(pesoDoEstado(undefined)).toBe(0);
  });
  it('estado em branco não apaga um com dados (o caso do celular novo)', () => {
    const r = protegerEstado({ 'grana-seria:v1': cheio }, { 'grana-seria:v1': vazio });
    expect(r['grana-seria:v1']).toBe(cheio);
  });
  it('quando os dados diminuem, o anterior vira cópia de segurança (até 3)', () => {
    const menos = JSON.stringify({ config: { renda: 3000 }, lancamentos: [{ id: 'a' }] });
    let s = protegerEstado({ 'grana-seria:v1': cheio }, { 'grana-seria:v1': menos });
    expect(s['grana-seria:v1']).toBe(menos);
    expect(JSON.parse(s[BACKUPS[0]]).estado).toBe(cheio);
    for (let i = 0; i < 4; i++) s = protegerEstado(s, { ...s, 'grana-seria:v1': JSON.stringify({ config: { renda: 1 } }) + ' '.repeat(i) });
    expect(Object.keys(s).filter((k) => k.includes('backup')).length).toBeLessThanOrEqual(3);
  });
  it('quando os dados crescem, só salva', () => {
    const r = protegerEstado({ 'grana-seria:v1': vazio }, { 'grana-seria:v1': cheio });
    expect(r['grana-seria:v1']).toBe(cheio);
    expect(r[BACKUPS[0]]).toBeUndefined();
  });
});
