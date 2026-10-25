import { describe, expect, it } from 'vitest';
import { situacaoDoAgente } from './agentesCustom';
import type { AgenteCustom } from './tipos';

const base = (tipo: AgenteCustom['tipo'], config: AgenteCustom['config'], progresso: AgenteCustom['progresso'] = []): AgenteCustom => ({ id: 'a', tipo, nome: 'x', avatar: '★', cor: 'var(--gold)', config, progresso, criadoEm: '2026-10-01', ativo: true });

describe('agentes personalizados', () => {
  it('juntar dinheiro: aporte por semana e por mês', () => {
    const s = situacaoDoAgente(base('juntar', { alvo: 6000, jaGuardado: 0, prazo: '2027-10-21' }), '2026-10-21');
    expect(s.proximoPasso).toContain('R$ 115 por semana');
    expect(s.pct).toBe(0);
    expect(s.sugestao).toBe(116);
  });
  it('meta batida e prazo vencido', () => {
    expect(situacaoDoAgente(base('juntar', { alvo: 100, jaGuardado: 100, prazo: '2027-01-01' }), '2026-10-21').concluido).toBe(true);
    const v = situacaoDoAgente(base('juntar', { alvo: 100, jaGuardado: 40, prazo: '2026-10-01' }), '2026-10-21');
    expect(v.concluido).toBe(false);
    expect(v.proximoPasso).toContain('O prazo passou');
  });
  it('registros somam no progresso', () => {
    const s = situacaoDoAgente(base('juntar', { alvo: 1000, jaGuardado: 100, prazo: '2027-10-21' }, [{ data: '2026-10-05', valor: 400 }]), '2026-10-21');
    expect(Math.round(s.pct)).toBe(50);
  });
  it('lembrete que se repete aponta a próxima data', () => {
    const s = situacaoDoAgente(base('lembrar', { descricao: 'Revisar contas', data: '2026-10-10', repete: 'semanal', hora: '09:00' }), '2026-10-21');
    expect(s.proximoPasso).toBe('Revisar contas · 24 out às 09:00');
  });
  it('52 semanas: semana certa e total', () => {
    const s = situacaoDoAgente(base('metodo', { metodo: '52-semanas', base: 1, inicio: '2026-10-01' }), '2026-10-21');
    expect(s.proximoPasso).toBe('Semana 3: guarde R$ 3');
    expect(s.resumo).toBe('R$ 0 de R$ 1.378');
  });
  it('pague-se primeiro: 10% da renda', () => {
    const s = situacaoDoAgente(base('metodo', { metodo: 'pague-se-primeiro', renda: 5000 }), '2026-10-21');
    expect(s.sugestao).toBe(500);
    expect(s.resumo).toBe('Pra viver: R$ 4.500 · Pra você (guardar): R$ 500');
  });
  it('personalizado com checklist', () => {
    const s = situacaoDoAgente(base('personalizado', { objetivo: 'Organizar papéis', checklist: ['Separar contas', 'Arquivar'] }, [{ data: '2026-10-02', valor: 1 }]), '2026-10-21');
    expect(s.pct).toBe(50);
    expect(s.proximoPasso).toBe('Arquivar');
  });
});
