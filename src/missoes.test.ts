import { describe, expect, it } from 'vitest';
import { andamento, desfazerUltimoRegistro, dividasRestantes, novaMissao, previsao, proximoPasso, registrar, valorAtual, virarMesRecorrente, type Missao } from './missoes';

const reserva = (extra: Partial<Missao> = {}): Missao => ({
  ...novaMissao(
    {
      agente: 'arkad',
      titulo: 'Reserva de emergência',
      tipo: 'reserva',
      metaValor: 12000,
      valorInicial: 1000,
      valorMensal: 400,
      dataInicio: '2026-10-21',
      passos: [
        { id: 'p1', ordem: 1, titulo: 'Guardar R$ 400 este mês', acao: 'guardar' },
        { id: 'p2', ordem: 2, titulo: 'Chegar a R$ 6.000 (metade)', valor: 6000 },
        { id: 'p3', ordem: 3, titulo: 'Reserva completa', valor: 12000 },
      ],
    },
    '2026-10-21'
  ),
  ...extra,
});

describe('missões', () => {
  it('previsão conta o mês atual enquanto ele não foi registrado', () => {
    const m = reserva();
    // falta 11.000 / 400 = 28 meses, começando em outubro
    expect(m.dataPrevista).toBe('2029-01');
    expect(m.previsaoOriginal).toBe('2029-01');
    expect(valorAtual(m)).toBe(1000);
  });

  it('registrar guarda o valor, marca o passo do mês e mantém em dia', () => {
    const m = registrar(reserva(), 400, { hoje: '2026-10-25' });
    expect(valorAtual(m)).toBe(1400);
    expect(m.passos[0].concluidoEm).toBeTruthy();
    expect(previsao(m, '2026-10-25')).toBe('2029-01');
    expect(andamento(m, '2026-10-25')).toMatchObject({ emDia: true, atras: 0 });
    expect(proximoPasso(m, '2026-10-25')?.id).toBe('p2');
  });

  it('nunca registra mês futuro', () => {
    const m = registrar(reserva(), 400, { hoje: '2026-10-25', mes: '2026-11' });
    expect(m.registros).toHaveLength(0);
  });

  it('mês que passou sem guardar deixa atrás e muda a data', () => {
    const m = reserva();
    const a = andamento(m, '2026-11-05');
    expect(a.emDia).toBe(false);
    expect(a.atras).toBe(400);
    expect(a.previsao).toBe('2029-02');
  });

  it('bater a meta conclui; desfazer volta', () => {
    const m = registrar(reserva({ valorInicial: 11800 }), 400, { hoje: '2026-10-25' });
    expect(m.status).toBe('concluida');
    expect(m.passos.every((p) => p.concluidoEm)).toBe(true);
    const d = desfazerUltimoRegistro(m);
    expect(d.status).toBe('ativa');
    expect(d.registros).toHaveLength(0);
  });

  it('dívida: pagamento abate na ordem da fila e a previsão usa os juros', () => {
    const m = novaMissao(
      {
        agente: 'dabasir',
        titulo: 'Sair das dívidas',
        tipo: 'divida',
        metaValor: 3500,
        valorInicial: 0,
        valorMensal: 400,
        dataInicio: '2026-10-21',
        metodo: 'juros',
        dividas: [
          { id: 'c', nome: 'Cartão', saldo: 3000, parcela: 200, jurosMes: 5 },
          { id: 'l', nome: 'Loja', saldo: 500, parcela: 100, jurosMes: null },
        ],
        passos: [{ id: 'p1', ordem: 1, titulo: 'Quitar Cartão', valor: 3000 }],
      },
      '2026-10-21'
    );
    expect(m.dataPrevista).not.toBeNull();
    const pago = registrar(m, 1000, { hoje: '2026-10-25' });
    expect(dividasRestantes(pago).map((d) => [d.id, d.saldo])).toEqual([
      ['c', 2000],
      ['l', 500],
    ]);
    expect(andamento(pago, '2026-10-25').falta).toBe(2500);
  });

  it('missão recorrente (contas) recomeça os passos no mês novo', () => {
    const m = reserva({ recorrente: true, tipo: 'contas', passos: [{ id: 'a', ordem: 1, titulo: 'Pagar luz', concluidoEm: '2026-10-10T12:00:00Z' }] });
    expect(virarMesRecorrente(m, '2026-10-25').passos[0].concluidoEm).toBeTruthy();
    expect(virarMesRecorrente(m, '2026-11-02').passos[0].concluidoEm).toBeNull();
  });
});
