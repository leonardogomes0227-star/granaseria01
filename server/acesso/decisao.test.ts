import { describe, expect, it } from 'vitest';
import { decidirAcesso } from './decisao';

const AGORA = Date.parse('2026-12-01T12:00:00Z');
const base = { criadoEm: null, novosDesde: undefined, corte: '2026-12-10T23:59:00-03:00', agora: AGORA };
const paga = (extra = {}) => ({ tipo: 'assinante' as const, status: 'ativo' as const, valido_ate: '2027-01-05T00:00:00Z', fundador: true, ...extra });

describe('decidirAcesso', () => {
  it('assinatura valendo: entra, com ou sem corte', () => {
    expect(decidirAcesso({ ...base, acesso: paga() })).toMatchObject({ estado: 'ativo', fundador: true });
    expect(decidirAcesso({ ...base, corte: '2026-11-01T00:00:00Z', acesso: paga() }).estado).toBe('ativo');
  });
  it('cortesia entra sempre', () => {
    expect(decidirAcesso({ ...base, corte: '2026-11-01T00:00:00Z', acesso: { tipo: 'cortesia', status: 'ativo', valido_ate: null, fundador: false } }).estado).toBe('ativo');
  });
  it('quem já usava e ainda não assinou tem prazo até o corte, com os dias que faltam', () => {
    expect(decidirAcesso({ ...base, acesso: null })).toMatchObject({ estado: 'carencia', dias: 10 });
  });
  it('passado o corte, sem assinatura, fica de fora', () => {
    expect(decidirAcesso({ ...base, agora: Date.parse('2026-12-11T12:00:00Z'), acesso: null })).toEqual({ estado: 'bloqueado' });
  });
  it('assinatura cancelada vale até o fim do que já foi pago, e depois bloqueia', () => {
    const cancelada = paga({ status: 'cancelado', valido_ate: '2026-12-20T00:00:00Z' });
    expect(decidirAcesso({ ...base, corte: '2026-11-01T00:00:00Z', acesso: cancelada })).toMatchObject({ estado: 'ativo', cancelada: true });
    expect(decidirAcesso({ ...base, corte: '2026-11-01T00:00:00Z', agora: Date.parse('2026-12-21T00:00:00Z'), acesso: cancelada }).estado).toBe('bloqueado');
  });
  it('assinatura vencida e não renovada também bloqueia depois do corte', () => {
    expect(decidirAcesso({ ...base, corte: '2026-11-01T00:00:00Z', acesso: paga({ valido_ate: '2026-11-20T00:00:00Z' }) }).estado).toBe('bloqueado');
  });
  it('conta criada depois de ACESSO_NOVOS_DESDE não ganha o prazo: precisa de convite e assinatura', () => {
    const novo = { ...base, novosDesde: '2026-11-28T00:00:00Z', criadoEm: '2026-11-30T10:00:00Z', acesso: null };
    expect(decidirAcesso(novo)).toEqual({ estado: 'bloqueado', novo: true });
    expect(decidirAcesso({ ...novo, acesso: paga() }).estado).toBe('ativo');
  });
  it('conta antiga (criada antes de ACESSO_NOVOS_DESDE) segue com o prazo', () => {
    expect(decidirAcesso({ ...base, novosDesde: '2026-11-28T00:00:00Z', criadoEm: '2026-05-01T10:00:00Z', acesso: null }).estado).toBe('carencia');
  });
  it('sem data de corte definida, ninguém é bloqueado por engano', () => {
    expect(decidirAcesso({ ...base, corte: undefined, acesso: null })).toEqual({ estado: 'liberado' });
    expect(decidirAcesso({ ...base, corte: 'data-invalida', acesso: null })).toEqual({ estado: 'liberado' });
  });
});
