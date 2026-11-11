// Nota de saúde financeira (0 a 100): 4 critérios com o mesmo peso. Pura, com teste.

import { brl0 } from './datas.js';
import { saldoAtual, totalDividas } from './dividas.js';
import { contasDoMes, gastoMensalMedio, guardadoNoMes, patrimonioGuardado, totalFixos, totalVariaveis } from './selectores.js';
import type { Estado } from './tipos.js';

export interface Criterio {
  id: 'reserva' | 'dividas' | 'poupanca' | 'contas';
  nome: string;
  pontos: number; // 0 a 100
  detalhe: string;
  dica: string;
  rota: string;
}
export interface Saude {
  nota: number;
  criterios: Criterio[];
  pior: Criterio;
}

const trava = (n: number) => Math.max(0, Math.min(100, n));

export function saudeFinanceira(e: Estado, mes: string, hoje: string): Saude {
  const renda = e.config.renda;
  const gasto = gastoMensalMedio(e, mes);
  const meses = gasto > 0 ? patrimonioGuardado(e) / gasto : 0;
  const dividas = totalDividas(e.dividas);
  const sobra = renda - totalFixos(e, mes) - totalVariaveis(e, mes);
  const taxa = renda > 0 ? Math.max(0, (sobra + guardadoNoMes(e, mes)) / renda) : 0;
  const atrasadas = contasDoMes(e, mes, hoje).filter((c) => c.estado === 'atrasada').length;
  const abertas = e.dividas.filter((d) => saldoAtual(d) > 0).length;
  const criterios: Criterio[] = [
    { id: 'reserva', nome: 'Reserva de emergência', pontos: trava((meses / 6) * 100), detalhe: `${meses.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} de 6 meses`, dica: gasto > 0 ? `Guarde ${brl0(gasto * 0.2)} por mês até completar 6 meses.` : 'Cadastre suas contas fixas pra eu calcular a meta.', rota: '/plano/reserva' },
    { id: 'dividas', nome: 'Dívidas', pontos: abertas === 0 ? 100 : trava(100 - (renda > 0 ? (dividas / (renda * 12)) * 260 : 100)), detalhe: abertas === 0 ? 'nenhuma em aberto' : `${brl0(dividas)} em aberto`, dica: 'Comece pela dívida de maior juro.', rota: '/plano/dividas' },
    { id: 'poupanca', nome: 'Quanto você guarda', pontos: trava((taxa / 0.2) * 100), detalhe: `${Math.round(taxa * 100)}% da renda (meta 20%)`, dica: 'Cortar assinaturas esquecidas já ajuda.', rota: '/plano/assinaturas' },
    { id: 'contas', nome: 'Contas em dia', pontos: atrasadas ? Math.max(0, 70 - atrasadas * 25) : 100, detalhe: atrasadas ? `${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}` : 'tudo em dia', dica: 'Dê baixa nas contas que você já pagou.', rota: '/lancamentos?aba=contas' },
  ];
  const nota = Math.round(criterios.reduce((t, c) => t + c.pontos, 0) / criterios.length);
  const pior = [...criterios].sort((a, b) => a.pontos - b.pontos)[0];
  return { nota, criterios, pior };
}
