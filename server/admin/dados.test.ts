import { describe, expect, it } from 'vitest';
import { auditarDados, copiaARecuperar, restaurarMaiorCopia, type ContaGuardada } from './dados';
import { BACKUPS, CHAVE, listarCopias } from '../protegerEstado';
import { pesoDoEstado } from '../../src/gs/pesoEstado';

const estado = (n: number) => JSON.stringify({ config: { renda: 5000, onboardingFeito: true }, lancamentos: Array.from({ length: n }, (_, i) => ({ id: `l${i}` })) });
const copia = (n: number, quando: string) => JSON.stringify({ salvoEm: quando, peso: n + 2, estado: estado(n) });
const conta = (id: string, state: Record<string, string>): ContaGuardada => ({ id, onde: 'whatsapp', nome: null, rotulo: id, state, atualizadoEm: null });

describe('painel do dono: quem perdeu dados', () => {
  const perdeu = { [CHAVE]: estado(1), [BACKUPS[0]]: copia(30, '2026-11-11T02:00:00.000Z') };
  const normal = { [CHAVE]: estado(20), [BACKUPS[0]]: copia(21, '2026-11-11T02:00:00.000Z') }; // apagou um item: não é perda
  it('acha só quem tem cópia bem maior que o atual', () => {
    const r = auditarDados([conta('a', perdeu), conta('b', normal), conta('c', { [CHAVE]: estado(10) }), conta('d', {})]);
    expect(r.total).toBe(4);
    expect(r.comDados).toBe(3);
    expect(r.emBranco).toBe(1);
    expect(r.comCopia).toBe(2);
    expect(r.perderam.map((p) => p.id)).toEqual(['a']);
    expect(r.perderam[0]).toMatchObject({ atual: 3, copia: 32, copiaEm: '2026-11-11T02:00:00.000Z' });
  });
  it('restaurar devolve a cópia e guarda o atual, para dar para desfazer', () => {
    const r = restaurarMaiorCopia(perdeu, new Date('2026-11-11T15:00:00Z'))!;
    expect(pesoDoEstado(r[CHAVE])).toBe(32);
    expect(listarCopias(r)[0]).toMatchObject({ peso: 3, salvoEm: '2026-11-11T15:00:00.000Z' });
    expect(copiaARecuperar(r)).toBeNull(); // rodar de novo não faz nada
    expect(restaurarMaiorCopia(r)).toBeNull();
  });
  it('quem não perdeu não é tocado', () => {
    expect(restaurarMaiorCopia(normal)).toBeNull();
    expect(restaurarMaiorCopia({})).toBeNull();
  });
});
