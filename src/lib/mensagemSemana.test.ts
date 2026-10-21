import { describe, expect, it } from 'vitest';
import { mensagemDaSemana, type FatosDaSemana } from './mensagemSemana';

const base: FatosDaSemana = { guardadoMes: 0, guardadoMesPassado: 0, sequencia: 0, estourou: false, passou: 0, quaseLa: null, cumpridas: 0, temMissao: false };

describe('mensagem da semana', () => {
  it('sem nada real pra comentar, fica a dica do agente', () => {
    expect(mensagemDaSemana(base)).toBeNull();
  });
  it('compara com o mês passado', () => {
    expect(mensagemDaSemana({ ...base, guardadoMes: 500, guardadoMesPassado: 200 })).toBe('Você guardou R$ 300 a mais que no mês passado. Isso é Babilônia pura.');
  });
  it('mês estourado vem antes de tudo', () => {
    expect(mensagemDaSemana({ ...base, estourou: true, passou: 120, guardadoMes: 500, guardadoMesPassado: 200 })).toMatch(/passou R\$ 120/);
  });
  it('perto da meta', () => {
    expect(mensagemDaSemana({ ...base, quaseLa: { titulo: 'Reserva de emergência', falta: 400 } })).toBe('Falta só R$ 400 pra reserva de emergência. Dá pra ver a linha de chegada.');
  });
  it('sequência e o que já guardou', () => {
    expect(mensagemDaSemana({ ...base, sequencia: 3, guardadoMes: 100, guardadoMesPassado: 100 })).toBe('3 meses seguidos guardando. Mês a mês, a bolsa enche.');
    expect(mensagemDaSemana({ ...base, guardadoMes: 100 })).toBe('Você já guardou R$ 100 este mês. Primeiro você, depois o resto.');
  });
  it('quem cuida das dívidas fala delas', () => {
    expect(mensagemDaSemana({ ...base, temMissao: true, dividas: { pagoMes: 0, falta: 2500 } })).toBe('Faltam R$ 2.500 pra sair das dívidas. Uma parcela de cada vez.');
    expect(mensagemDaSemana({ ...base, temMissao: true, dividas: { pagoMes: 512, falta: 1988 } })).toBe('Você já pagou R$ 512 das dívidas este mês. Uma de cada vez.');
  });
});
