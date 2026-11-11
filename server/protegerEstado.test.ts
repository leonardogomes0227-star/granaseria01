import { describe, expect, it } from 'vitest';
import { protegerEstado, BACKUPS, foiMantido, listarCopias } from './protegerEstado';
import { pesoDoEstado, quemFica, reducaoBrusca } from '../src/gs/pesoEstado';

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

  // o caso que fez gente perder dados: computador com tudo, celular só com o cadastro inicial
  const computador = JSON.stringify({ config: { renda: 5000, onboardingFeito: true }, gastosFixos: Array.from({ length: 8 }, (_, i) => ({ id: `g${i}` })), lancamentos: Array.from({ length: 20 }, (_, i) => ({ id: `l${i}` })), dividas: [{ id: 'd' }] });
  const celular = JSON.stringify({ config: { renda: 5000, onboardingFeito: true }, lancamentos: [{ id: 'x' }] });
  it('aparelho com poucos dados não passa por cima da conta completa', () => {
    const antes = { 'grana-seria:v1': computador };
    const pedido = { 'grana-seria:v1': celular, 'gs-nome': 'Leo' };
    const r = protegerEstado(antes, pedido);
    expect(r['grana-seria:v1']).toBe(computador);
    expect(r['gs-nome']).toBe('Leo');
    expect(foiMantido(antes, pedido, r)).toBe(true);
  });
  it('apagar aos poucos passa, e a mesma coisa de novo não conta como mantido', () => {
    const umAMenos = JSON.stringify({ ...JSON.parse(computador), lancamentos: Array.from({ length: 19 }, (_, i) => ({ id: `l${i}` })) });
    const antes = { 'grana-seria:v1': computador };
    const r = protegerEstado(antes, { 'grana-seria:v1': umAMenos });
    expect(r['grana-seria:v1']).toBe(umAMenos);
    expect(foiMantido(antes, { 'grana-seria:v1': umAMenos }, r)).toBe(false);
    expect(foiMantido(antes, antes, protegerEstado(antes, antes))).toBe(false);
  });
  it('importar ou restaurar de propósito passa, e o anterior fica como cópia', () => {
    const r = protegerEstado({ 'grana-seria:v1': computador }, { 'grana-seria:v1': celular }, new Date('2026-11-11T12:00:00Z'), true);
    expect(r['grana-seria:v1']).toBe(celular);
    const copias = listarCopias(r);
    expect(copias).toHaveLength(1);
    expect(copias[0].estado).toBe(computador);
    expect(copias[0].peso).toBe(pesoDoEstado(computador));
    expect(copias[0].salvoEm).toBe('2026-11-11T12:00:00.000Z');
  });
  it('quem fica: em branco e "bem menor" perdem sem perguntar, dos dois lados', () => {
    const pc = pesoDoEstado(computador), cel = pesoDoEstado(celular);
    expect(reducaoBrusca(pc, cel)).toBe(true);
    expect(quemFica(cel, pc, true)).toBe('remoto'); // celular abrindo pela primeira vez: pega a conta
    expect(quemFica(cel, pc, false)).toBe('remoto');
    expect(quemFica(pc, cel, false)).toBe('local'); // computador não aceita o estado pequeno, mesmo "mais novo"
    expect(quemFica(pc, cel, true)).toBe('local');
    expect(quemFica(0, pc, false)).toBe('remoto');
    expect(quemFica(pc, 0, false)).toBe('local');
    expect(quemFica(pc, pc - 1, false)).toBe('pelaData');
    expect(quemFica(pc, pc - 1, true)).toBe('perguntar');
  });
});
